#!/usr/bin/env python3
"""
Python unit tests for greenlet A2A agent
"""

import sys
import os

# Add src to path FIRST before any other imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../src/agents/python'))

# Now we can import
import pytest

# Skip the entire module when the optional greenlet dependency is unavailable.
# pytest.importorskip returns the imported module when it can be resolved, which
# lets the rest of the tests use the package without additional guards.
greenlet = pytest.importorskip(
    "greenlet",
    reason="greenlet package is not installed; skipping greenlet agent tests",
)

from greenlet_a2a_agent import GreenletA2AAgent, EchoAgent
from greenlet_coordinator import GreenletCoordinator


class TestGreenletAgent:
    """Test cases for GreenletA2AAgent"""
    
    def test_agent_creation(self):
        """Test basic agent creation"""
        agent = GreenletA2AAgent("test-agent", ["capability1", "capability2"])
        assert agent.agent_id == "test-agent"
        assert agent.capabilities == ["capability1", "capability2"]
        assert agent.running is False
        
    def test_greenlet_switching(self):
        """Test that greenlet context switching works correctly"""
        results = []
        
        def greenlet_func():
            results.append("start")
            greenlet.getcurrent().parent.switch()
            results.append("end")
            
        g = greenlet.greenlet(greenlet_func)
        g.switch()
        results.append("middle")
        g.switch()
        
        assert results == ["start", "middle", "end"]
        
    def test_echo_agent(self):
        """Test echo agent behavior"""
        agent = EchoAgent("echo-test")
        assert agent.agent_id == "echo-test"
        assert "echo" in agent.capabilities


class TestGreenletCoordinator:
    """Test cases for GreenletCoordinator"""
    
    def test_coordinator_creation(self):
        """Test coordinator creation"""
        coordinator = GreenletCoordinator(max_agents=50)
        assert coordinator.max_agents == 50
        assert len(coordinator.agents) == 0
        
    def test_register_agent(self):
        """Test agent registration"""
        coordinator = GreenletCoordinator(max_agents=10)
        agent = EchoAgent("echo-1")
        
        coordinator.register_agent(agent)
        
        assert len(coordinator.agents) == 1
        assert "echo-1" in coordinator.agents
        assert agent.running is True
        
        # Cleanup
        agent.stop()
        
    def test_max_agents_limit(self):
        """Test that max agents limit is enforced"""
        coordinator = GreenletCoordinator(max_agents=2)
        
        agent1 = EchoAgent("echo-1")
        agent2 = EchoAgent("echo-2")
        agent3 = EchoAgent("echo-3")
        
        coordinator.register_agent(agent1)
        coordinator.register_agent(agent2)
        
        with pytest.raises(ValueError, match="Maximum agents"):
            coordinator.register_agent(agent3)
            
        # Cleanup
        agent1.stop()
        agent2.stop()
        
    def test_unregister_agent(self):
        """Test agent unregistration"""
        coordinator = GreenletCoordinator()
        agent = EchoAgent("echo-1")
        
        coordinator.register_agent(agent)
        assert len(coordinator.agents) == 1
        
        coordinator.unregister_agent("echo-1")
        assert len(coordinator.agents) == 0
        
    def test_coordinator_stats(self):
        """Test coordinator statistics"""
        coordinator = GreenletCoordinator(max_agents=100)
        
        for i in range(5):
            agent = EchoAgent(f"echo-{i}")
            coordinator.register_agent(agent)
            
        stats = coordinator.get_stats()
        assert stats["total_agents"] == 5
        assert stats["max_agents"] == 100
        assert len(stats["agent_ids"]) == 5
        
        # Cleanup
        for i in range(5):
            coordinator.unregister_agent(f"echo-{i}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
