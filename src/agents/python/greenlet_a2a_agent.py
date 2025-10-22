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
from collections import deque


class GreenletA2AAgent:
    """Base class for greenlet-based A2A agents with cooperative multitasking"""
    
    def __init__(self, agent_id: str, capabilities: List[str], max_queue_size: int = 100):
        """
        Initialize greenlet A2A agent
        
        Args:
            agent_id: Unique identifier for this agent
            capabilities: List of capabilities this agent provides
            max_queue_size: Maximum size of the message queue
        """
        self.agent_id = agent_id
        self.capabilities = capabilities
        self.running = False
        self.message_queue = deque(maxlen=max_queue_size)
        self.main_greenlet = None
        self.agent_greenlet = None
        self.metrics = {
            "messages_received": 0,
            "messages_sent": 0,
            "errors": 0,
            "start_time": None,
            "last_message_time": None
        }
        
    def start(self):
        """Start the agent in a greenlet"""
        self.running = True
        self.metrics["start_time"] = time.time()
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
            # Process message queue first
            while self.message_queue and self.running:
                message = self.message_queue.popleft()
                try:
                    self.handle_message(message)
                except Exception as e:
                    self.metrics["errors"] += 1
                    sys.stderr.write(f"Error handling message: {e}\n")
            
            # Yield control back to main greenlet and wait for message
            message = self.main_greenlet.switch()
            
            if message:
                try:
                    self.handle_message(message)
                except Exception as e:
                    self.metrics["errors"] += 1
                    sys.stderr.write(f"Error handling message: {e}\n")
                
            # Small sleep to prevent tight loop
            time.sleep(0.001)
            
    def handle_message(self, message: Dict[str, Any]):
        """
        Handle incoming message (override in subclass)
        
        Args:
            message: Message dictionary with 'type' and 'data' fields
        """
        self.metrics["messages_received"] += 1
        self.metrics["last_message_time"] = time.time()
        msg_type = message.get('type')
        
        if msg_type == 'agent.ping':
            self._send_message({
                "type": "agent.pong",
                "data": {"agent_id": self.agent_id}
            })
        elif msg_type == 'agent.stop':
            self.stop()
        elif msg_type == 'agent.metrics':
            # Send metrics
            uptime = time.time() - self.metrics["start_time"] if self.metrics["start_time"] else 0
            self._send_message({
                "type": "agent.metrics_response",
                "data": {
                    **self.metrics,
                    "uptime": uptime,
                    "queue_size": len(self.message_queue)
                }
            })
        else:
            # Subclass should override to handle specific messages
            pass
            
    def _send_message(self, message: Dict[str, Any]):
        """Send message via stdout (JSON-RPC protocol)"""
        try:
            self.metrics["messages_sent"] += 1
            json_str = json.dumps(message)
            print(json_str, flush=True)
        except Exception as e:
            self.metrics["errors"] += 1
            sys.stderr.write(f"Error sending message: {e}\n")
            
    def receive_message(self, message: Dict[str, Any]):
        """
        Queue message for processing and switch to agent greenlet
        
        Args:
            message: Message to process
        """
        if self.agent_greenlet and not self.agent_greenlet.dead:
            # If queue is full, process in greenlet immediately
            if len(self.message_queue) >= self.message_queue.maxlen:
                self.agent_greenlet.switch(message)
            else:
                self.message_queue.append(message)
                self.agent_greenlet.switch(None)


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
