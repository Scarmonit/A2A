import os
import lancedb
from lancedb.pydantic import LanceModel, Vector
from lancedb.embeddings import get_registry
import pyarrow as pa
from pathlib import Path
from typing import Generator, List
import fnmatch

# Initialize embedding model
func = get_registry().get("openai").create(
    name="voyage-code-3",
    base_url="https://api.voyageai.com/v1/",
    api_key=os.environ.get("VOYAGE_API_KEY"),
)

class CodeChunks(LanceModel):
    filename: str
    text: str = func.SourceField()
    vector: Vector(1024) = func.VectorField()  # voyage-code-3 dimension
    repository: str
    language: str
    chunk_index: int

def should_index_file(filepath: Path) -> bool:
    """Determine if file should be indexed based on extension and patterns."""
    ignore_patterns = ['node_modules', '.git', 'dist', 'build', '__pycache__', '.env']
    code_extensions = ['.ts', '.js', '.py', '.tsx', '.jsx', '.md', '.json', '.yaml', '.yml']
    
    # Check if file is in ignore patterns
    if any(pattern in str(filepath) for pattern in ignore_patterns):
        return False
    
    # Check if file has valid extension
    return filepath.suffix in code_extensions

def chunk_file(filepath: Path, max_tokens: int = 15000) -> List[str]:
    """Chunk file content. For now, use simple truncation strategy."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Simple chunking: split by lines and group
        lines = content.split('\n')
        chunks = []
        current_chunk = []
        current_size = 0
        
        for line in lines:
            line_size = len(line.split())
            if current_size + line_size > max_tokens:
                chunks.append('\n'.join(current_chunk))
                current_chunk = [line]
                current_size = line_size
            else:
                current_chunk.append(line)
                current_size += line_size
        
        if current_chunk:
            chunks.append('\n'.join(current_chunk))
        
        return chunks if chunks else [content]
    except Exception as e:
        print(f"Error reading {filepath}: {e}")
        return []

def get_language(filepath: Path) -> str:
    """Detect language from file extension."""
    ext_map = {
        '.ts': 'typescript',
        '.tsx': 'typescript',
        '.js': 'javascript',
        '.jsx': 'javascript',
        '.py': 'python',
        '.md': 'markdown',
        '.json': 'json',
        '.yaml': 'yaml',
        '.yml': 'yaml'
    }
    return ext_map.get(filepath.suffix, 'unknown')

def process_repository(repo_path: str, repo_name: str) -> Generator[pa.RecordBatch, None, None]:
    """Process repository and yield batches for indexing."""
    repo_path = Path(repo_path)
    
    for filepath in repo_path.rglob('*'):
        if not filepath.is_file() or not should_index_file(filepath):
            continue
        
        chunks = chunk_file(filepath)
        relative_path = str(filepath.relative_to(repo_path))
        language = get_language(filepath)
        
        for idx, chunk in enumerate(chunks):
            if not chunk.strip():
                continue
            
            filename_arr = pa.array([relative_path], type=pa.string())
            text_arr = pa.array([chunk], type=pa.string())
            repo_arr = pa.array([repo_name], type=pa.string())
            lang_arr = pa.array([language], type=pa.string())
            chunk_idx_arr = pa.array([idx], type=pa.int32())
            
            yield pa.RecordBatch.from_arrays(
                [filename_arr, text_arr, repo_arr, lang_arr, chunk_idx_arr],
                ["filename", "text", "repository", "language", "chunk_index"]
            )

def create_index(db_path: str = "./data/vector_db", repo_path: str = ".", repo_name: str = "A2A"):
    """Create or update the vector database index."""
    db = lancedb.connect(db_path)
    
    # Create table (overwrite if exists for now)
    table = db.create_table(
        f"code_chunks_{repo_name.lower()}",
        schema=CodeChunks,
        mode="overwrite"
    )
    
    print(f"Indexing repository: {repo_name} from {repo_path}")
    table.add(process_repository(repo_path, repo_name))
    print(f"Indexing complete! Table created: code_chunks_{repo_name.lower()}")
    
    return table

if __name__ == "__main__":
    # Index the A2A repository
    create_index(
        db_path="./data/vector_db",
        repo_path=".",
        repo_name="A2A"
    )
