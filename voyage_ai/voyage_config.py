"""Voyage AI Configuration Management - Settings and environment configuration."""

import os
from typing import Dict, Any, Optional
from dataclasses import dataclass, field
import json
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class VoyageConfig:
    """Configuration class for Voyage AI integration."""
    
    # API Configuration
    api_key: Optional[str] = field(default=None)
    api_base_url: str = field(default="https://api.voyageai.com/v1")
    
    # Model Configuration
    default_embedding_model: str = field(default="voyage-3")
    default_rerank_model: str = field(default="rerank-2")
    default_multimodal_model: str = field(default="voyage-multimodal-3")
    
    # Embedding Configuration
    embedding_dimension: Dict[str, int] = field(default_factory=lambda: {
        "voyage-3": 1024,
        "voyage-3-lite": 512,
        "voyage-code-3": 1024,
        "voyage-finance-2": 1024,
        "voyage-law-2": 1024,
        "voyage-multilingual-2": 1024,
        "voyage-multimodal-3": 1024
    })
    
    # Request Configuration
    max_retries: int = field(default=3)
    timeout: int = field(default=60)
    batch_size: int = field(default=128)
    
    # Processing Configuration
    truncation: bool = field(default=True)
    max_tokens: int = field(default=32000)
    
    # Cache Configuration
    enable_cache: bool = field(default=False)
    cache_dir: str = field(default=".voyage_cache")
    cache_ttl: int = field(default=3600)  # seconds
    
    # Rate Limiting
    rate_limit_per_minute: int = field(default=300)
    rate_limit_tokens_per_minute: int = field(default=1000000)
    
    # Logging Configuration
    log_level: str = field(default="INFO")
    log_requests: bool = field(default=False)
    log_responses: bool = field(default=False)
    
    def __post_init__(self):
        """Validate and setup configuration after initialization."""
        if self.api_key is None:
            self.api_key = os.getenv('VOYAGE_API_KEY')
        
        if not self.api_key:
            logger.warning("No Voyage AI API key provided. Set VOYAGE_API_KEY environment variable.")
        
        # Set logging level
        logging.getLogger().setLevel(getattr(logging, self.log_level.upper()))
        
        # Create cache directory if needed
        if self.enable_cache and not os.path.exists(self.cache_dir):
            os.makedirs(self.cache_dir)
            logger.info(f"Created cache directory: {self.cache_dir}")
    
    @classmethod
    def from_env(cls) -> 'VoyageConfig':
        """Create configuration from environment variables."""
        return cls(
            api_key=os.getenv('VOYAGE_API_KEY'),
            default_embedding_model=os.getenv('VOYAGE_EMBEDDING_MODEL', 'voyage-3'),
            default_rerank_model=os.getenv('VOYAGE_RERANK_MODEL', 'rerank-2'),
            max_retries=int(os.getenv('VOYAGE_MAX_RETRIES', '3')),
            timeout=int(os.getenv('VOYAGE_TIMEOUT', '60')),
            batch_size=int(os.getenv('VOYAGE_BATCH_SIZE', '128')),
            enable_cache=os.getenv('VOYAGE_ENABLE_CACHE', 'false').lower() == 'true',
            cache_dir=os.getenv('VOYAGE_CACHE_DIR', '.voyage_cache'),
            log_level=os.getenv('VOYAGE_LOG_LEVEL', 'INFO')
        )
    
    @classmethod
    def from_file(cls, config_path: str) -> 'VoyageConfig':
        """Load configuration from JSON file."""
        try:
            with open(config_path, 'r') as f:
                config_dict = json.load(f)
            logger.info(f"Loaded configuration from {config_path}")
            return cls(**config_dict)
        except FileNotFoundError:
            logger.error(f"Configuration file not found: {config_path}")
            raise
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in configuration file: {e}")
            raise
    
    def to_file(self, config_path: str) -> None:
        """Save configuration to JSON file."""
        config_dict = {
            'api_key': self.api_key,
            'api_base_url': self.api_base_url,
            'default_embedding_model': self.default_embedding_model,
            'default_rerank_model': self.default_rerank_model,
            'default_multimodal_model': self.default_multimodal_model,
            'max_retries': self.max_retries,
            'timeout': self.timeout,
            'batch_size': self.batch_size,
            'truncation': self.truncation,
            'max_tokens': self.max_tokens,
            'enable_cache': self.enable_cache,
            'cache_dir': self.cache_dir,
            'cache_ttl': self.cache_ttl,
            'rate_limit_per_minute': self.rate_limit_per_minute,
            'rate_limit_tokens_per_minute': self.rate_limit_tokens_per_minute,
            'log_level': self.log_level,
            'log_requests': self.log_requests,
            'log_responses': self.log_responses
        }
        
        with open(config_path, 'w') as f:
            json.dump(config_dict, f, indent=2)
        logger.info(f"Saved configuration to {config_path}")
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert configuration to dictionary."""
        return {
            'api_key': self.api_key,
            'api_base_url': self.api_base_url,
            'default_embedding_model': self.default_embedding_model,
            'default_rerank_model': self.default_rerank_model,
            'default_multimodal_model': self.default_multimodal_model,
            'max_retries': self.max_retries,
            'timeout': self.timeout,
            'batch_size': self.batch_size,
            'truncation': self.truncation,
            'max_tokens': self.max_tokens,
            'enable_cache': self.enable_cache,
            'cache_dir': self.cache_dir,
            'cache_ttl': self.cache_ttl,
            'rate_limit_per_minute': self.rate_limit_per_minute,
            'rate_limit_tokens_per_minute': self.rate_limit_tokens_per_minute,
            'log_level': self.log_level,
            'log_requests': self.log_requests,
            'log_responses': self.log_responses
        }
    
    def get_model_dimension(self, model: str) -> int:
        """Get embedding dimension for a specific model."""
        return self.embedding_dimension.get(model, 1024)
    
    def validate(self) -> bool:
        """Validate configuration settings."""
        if not self.api_key:
            logger.error("API key is required")
            return False
        
        if self.max_retries < 0:
            logger.error("max_retries must be non-negative")
            return False
        
        if self.timeout <= 0:
            logger.error("timeout must be positive")
            return False
        
        if self.batch_size <= 0:
            logger.error("batch_size must be positive")
            return False
        
        logger.info("Configuration validation passed")
        return True


class VoyageConfigManager:
    """Manager for handling multiple configurations and profiles."""
    
    def __init__(self, default_config: Optional[VoyageConfig] = None):
        """
        Initialize configuration manager.
        
        Args:
            default_config: Default configuration to use
        """
        self.default_config = default_config or VoyageConfig.from_env()
        self.profiles: Dict[str, VoyageConfig] = {}
        self.active_profile: str = "default"
    
    def add_profile(self, name: str, config: VoyageConfig) -> None:
        """Add a configuration profile."""
        self.profiles[name] = config
        logger.info(f"Added configuration profile: {name}")
    
    def load_profile(self, name: str, config_path: str) -> None:
        """Load a configuration profile from file."""
        config = VoyageConfig.from_file(config_path)
        self.add_profile(name, config)
    
    def set_active_profile(self, name: str) -> None:
        """Set the active configuration profile."""
        if name not in self.profiles and name != "default":
            raise ValueError(f"Profile '{name}' not found")
        self.active_profile = name
        logger.info(f"Active profile set to: {name}")
    
    def get_active_config(self) -> VoyageConfig:
        """Get the currently active configuration."""
        if self.active_profile == "default":
            return self.default_config
        return self.profiles[self.active_profile]
    
    def get_profile(self, name: str) -> VoyageConfig:
        """Get a specific configuration profile."""
        if name == "default":
            return self.default_config
        return self.profiles.get(name)
    
    def list_profiles(self) -> list:
        """List all available profiles."""
        return ["default"] + list(self.profiles.keys())
    
    def remove_profile(self, name: str) -> None:
        """Remove a configuration profile."""
        if name in self.profiles:
            del self.profiles[name]
            logger.info(f"Removed profile: {name}")
            
            if self.active_profile == name:
                self.active_profile = "default"
                logger.info("Active profile reset to default")


# Global configuration instance
_global_config: Optional[VoyageConfig] = None


def get_config() -> VoyageConfig:
    """Get the global configuration instance."""
    global _global_config
    if _global_config is None:
        _global_config = VoyageConfig.from_env()
    return _global_config


def set_config(config: VoyageConfig) -> None:
    """Set the global configuration instance."""
    global _global_config
    _global_config = config
    logger.info("Global configuration updated")


def reset_config() -> None:
    """Reset global configuration to default."""
    global _global_config
    _global_config = None
    logger.info("Global configuration reset")


if __name__ == "__main__":
    # Example usage
    config = VoyageConfig.from_env()
    print(f"Default model: {config.default_embedding_model}")
    print(f"Batch size: {config.batch_size}")
    print(f"Config valid: {config.validate()}")
    
    # Save configuration
    config.to_file("voyage_config.json")
    
    # Load configuration
    loaded_config = VoyageConfig.from_file("voyage_config.json")
    print(f"Loaded config model: {loaded_config.default_embedding_model}")
