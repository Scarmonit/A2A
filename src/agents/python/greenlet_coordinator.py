#!/usr/bin/env python3
"""
Greenlet Coordinator

Manages multiple greenlet agents with round-robin scheduling.
Enables 1000+ lightweight agents in a single process.
"""

import sys
import time
from typing import Dict, List
from greenlet_a2a_agent import GreenletA2AAgent


class GreenletCoordinator:
    """Coordinates multiple greenlet agents with round-robin scheduling"""
    
    def __init__(self, max_agents: int = 100):
        """
        Initialize coordinator
        
        Args:
            max_agents: Maximum number of concurrent agents
        """
        self.max_agents = max_agents
        self.agents: Dict[str, GreenletA2AAgent] = {}
        self.agent_queue: List[str] = []  # Round-robin queue
        
    def register_agent(self, agent: GreenletA2AAgent):
        """
        Register and start a new agent
        
        Args:
            agent: Agent to register
            
        Raises:
            ValueError: If max agents limit reached
        """
        if len(self.agents) >= self.max_agents:
            raise ValueError(f"Maximum agents ({self.max_agents}) reached")
            
        self.agents[agent.agent_id] = agent
        self.agent_queue.append(agent.agent_id)
        agent.start()
        
    def unregister_agent(self, agent_id: str):
        """Remove agent from coordinator"""
        if agent_id in self.agents:
            agent = self.agents[agent_id]
            agent.stop()
            del self.agents[agent_id]
            if agent_id in self.agent_queue:
                self.agent_queue.remove(agent_id)
                
    def route_message(self, agent_id: str, message: dict):
        """Route message to specific agent"""
        if agent_id in self.agents:
            self.agents[agent_id].receive_message(message)
        else:
            sys.stderr.write(f"Agent not found: {agent_id}\n")
            
    def schedule(self):
        """
        Round-robin scheduling tick
        Gives each agent a time slice to process messages
        """
        if not self.agent_queue:
            return
            
        # Rotate queue for round-robin
        agent_id = self.agent_queue.pop(0)
        self.agent_queue.append(agent_id)
        
        # Let agent process (it will yield back when done)
        if agent_id in self.agents:
            agent = self.agents[agent_id]
            if agent.agent_greenlet and not agent.agent_greenlet.dead:
                agent.agent_greenlet.switch(None)
                
    def get_stats(self) -> dict:
        """Get coordinator statistics"""
        return {
            "total_agents": len(self.agents),
            "max_agents": self.max_agents,
            "agent_ids": list(self.agents.keys())
        }


if __name__ == "__main__":
    # Example usage
    from greenlet_a2a_agent import EchoAgent
    
    coordinator = GreenletCoordinator(max_agents=10)
    
    # Create and register 3 echo agents
    for i in range(3):
        agent = EchoAgent(f"echo-{i}")
        coordinator.register_agent(agent)
        
    print(f"Coordinator stats: {coordinator.get_stats()}")
    
    # Run scheduler
    try:
        while True:
            coordinator.schedule()
            time.sleep(0.01)  # 10ms tick
    except KeyboardInterrupt:
        print("\nShutting down coordinator")
