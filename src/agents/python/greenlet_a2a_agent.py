#!/usr/bin/env python3
"""
Greenlet-based A2A Agent

Lightweight cooperative multitasking agent using Python greenlet library.
Memory footprint: ~4KB per agent vs 1MB+ for thread-based agents.
"""

import sys
import json
import time
import greenlet
from typing import Dict, List, Any, Optional


class GreenletA2AAgent:
    """Base class for greenlet-based A2A agents with cooperative multitasking"""
    
    def __init__(self, agent_id: str, capabilities: List[str]):
        """
        Initialize greenlet A2A agent
        
        Args:
            agent_id: Unique identifier for this agent
            capabilities: List of capabilities this agent provides
        """
        self.agent_id = agent_id
        self.capabilities = capabilities
        self.running = False
        self.message_queue = []
        self.main_greenlet = None
        self.agent_greenlet = None
        
    def start(self):
        """Start the agent in a greenlet"""
        self.running = True
        self.main_greenlet = greenlet.getcurrent()
        self.agent_greenlet = greenlet.greenlet(self._run)
        self.agent_greenlet.switch()
        
    def stop(self):
        """Stop the agent gracefully"""
        self.running = False
        if self.agent_greenlet and not self.agent_greenlet.dead:
            self.agent_greenlet.switch(None)
        
    def _run(self):
        """Main greenlet execution loop"""
        # Send registration message
        self._send_message({
            "type": "agent.register",
            "data": {
                "id": self.agent_id,
                "capabilities": self.capabilities
            }
        })
        
        while self.running:
            # Yield control back to main greenlet and wait for message
            message = self.main_greenlet.switch()
            
            if message:
                self.handle_message(message)
                
            # Small sleep to prevent tight loop
            time.sleep(0.001)
            
    def handle_message(self, message: Dict[str, Any]):
        """
        Handle incoming message (override in subclass)
        
        Args:
            message: Message dictionary with 'type' and 'data' fields
        """
        msg_type = message.get('type')
        
        if msg_type == 'agent.ping':
            self._send_message({
                "type": "agent.pong",
                "data": {"agent_id": self.agent_id}
            })
        elif msg_type == 'agent.stop':
            self.stop()
        else:
            # Subclass should override to handle specific messages
            pass
            
    def _send_message(self, message: Dict[str, Any]):
        """Send message via stdout (JSON-RPC protocol)"""
        try:
            json_str = json.dumps(message)
            print(json_str, flush=True)
        except Exception as e:
            sys.stderr.write(f"Error sending message: {e}\n")
            
    def receive_message(self, message: Dict[str, Any]):
        """
        Queue message for processing and switch to agent greenlet
        
        Args:
            message: Message to process
        """
        if self.agent_greenlet and not self.agent_greenlet.dead:
            self.agent_greenlet.switch(message)


class EchoAgent(GreenletA2AAgent):
    """Example agent that echoes messages"""
    
    def __init__(self, agent_id: str = "echo-agent"):
        super().__init__(agent_id, ["echo"])
        
    def handle_message(self, message: Dict[str, Any]):
        """Echo received messages back"""
        super().handle_message(message)
        
        if message.get('type') == 'agent.echo':
            self._send_message({
                "type": "agent.echo_response",
                "data": message.get('data', {})
            })


if __name__ == "__main__":
    # Example: Run echo agent
    agent = EchoAgent()
    agent.start()
    
    # Read messages from stdin
    try:
        for line in sys.stdin:
            try:
                message = json.loads(line.strip())
                agent.receive_message(message)
            except json.JSONDecodeError:
                sys.stderr.write(f"Invalid JSON: {line}\n")
    except KeyboardInterrupt:
        agent.stop()
