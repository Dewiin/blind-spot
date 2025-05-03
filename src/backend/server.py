"""
Blind-Spot API: An application to describe images for visually impaired users
"""

import os
import tempfile
import uuid
import logging
from typing import List, Dict, Optional, Any
import time
from functools import wraps
import base64

from dotenv import load_dotenv
from flask import Flask, request, jsonify, make_response, g
from flask_cors import CORS
from werkzeug.utils import secure_filename
from werkzeug.middleware.proxy_fix import ProxyFix
from pydantic import BaseModel, Field, ValidationError
from langchain.output_parsers import PydanticOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.exceptions import OutputParserException
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------

class Config:
    """Application configuration settings."""
    
    # API Settings
    DEBUG = os.getenv("DEBUG", "False").lower() in ("true", "1", "t")
    HOST = os.getenv("HOST", "0.0.0.0")
    PORT = int(os.getenv("PORT", "5001"))
    
    # Security Settings
    SECRET_KEY = os.getenv("SECRET_KEY", str(uuid.uuid4()))
    API_KEY = os.getenv("API_KEY")
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
    
    # Google API Settings
    GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
    GEMINI_MODEL_NAME = os.getenv("GEMINI_MODEL_NAME", "gemini-2.0-flash")
    
    # File Upload Settings
    UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER", "uploads")
    MAX_CONTENT_LENGTH = int(os.getenv("MAX_CONTENT_LENGTH", 16 * 1024 * 1024))  # 16MB
    ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg"}
    
    # Cache Settings
    CACHE_TIMEOUT = int(os.getenv("CACHE_TIMEOUT", 3600))  # 1 hour

# -----------------------------------------------------------------------------
# Models
# -----------------------------------------------------------------------------

class ImageDescription(BaseModel):
    """Model for image description outputs."""
    
    description: str = Field(description="Detailed description of the image for a blind person.")
    importance: int = Field(
        description="Importance level from 1-10",
        ge=1,
        le=10
    )
    
    @classmethod
    def schema(cls):
        return super().schema()

class DescriptionHistory:
    """Class to track the history of image descriptions."""
    
    def __init__(self, max_history: int = 10):
        self.history: List[Dict] = []
        self.max_history = max_history
    
    def add_response(self, description: str, importance: int, image_id: str):
        """Add a new description to the history."""
        entry = {
            "description": description,
            "importance": importance,
            "image_id": image_id,
            "timestamp": time.time()
        }
        
        self.history.append(entry)
        
        # Trim history if it exceeds max length
        if len(self.history) > self.max_history:
            self.history = self.history[-self.max_history:]
    
    def get_formatted_history(self) -> str:
        """Format the history for inclusion in prompts."""
        return "\n".join(
            f"Previous description {i+1}: {item['description']} (Importance: {item['importance']})"
            for i, item in enumerate(self.history)
        )
    
    def clear(self):
        """Clear the history."""
        self.history = []

# -----------------------------------------------------------------------------
# Services
# -----------------------------------------------------------------------------

class AIService:
    """Service for interacting with AI models."""
    
    _instance = None
    _model = None
    _parser = None
    
    def __new__(cls):
        """Singleton pattern to ensure one instance."""
        if cls._instance is None:
            cls._instance = super(AIService, cls).__new__(cls)
        return cls._instance
    
    @property
    def model(self) -> ChatGoogleGenerativeAI:
        """Lazy-loaded Gemini model."""
        if self._model is None:
            logger.info("Initializing Gemini model")
            self._model = ChatGoogleGenerativeAI(
                model=Config.GEMINI_MODEL_NAME, 
                api_key=Config.GOOGLE_API_KEY,
                temperature=0.2,
                timeout=30
            )
        return self._model
    
    @property
    def parser(self) -> PydanticOutputParser:
        """Output parser for the model responses."""
        if self._parser is None:
            logger.info("Initializing output parser")
            self._parser = PydanticOutputParser(pydantic_object=ImageDescription)
        return self._parser
    
    def get_prompt(self, history: Optional[DescriptionHistory] = None) -> ChatPromptTemplate:
        """Create a prompt template with optional history context."""
        history_context = ""
        if history and history.history:
            history_context = f"""
            Here are previous descriptions you've provided for context:
            {history.get_formatted_history()}
            """
        
        return ChatPromptTemplate.from_messages([
            ("system", 
                '''
                You are to return the description of an image and the importance of the image based on what you can detect.
                The format instructions for the model are:
                {format_instructions}
                The history context is:
                {history}
                
                Imagine you are a guide with the personality of a Gen Alpha influencer so use words like gyatt, skibidi, rizz and aura, but DO NOT CURSE, you are to take in an image and describe the contents to a blind person, 
                make sure your output is highlighting the obstacles and people in their path so they do not have to run into any trouble. 
                You are to return the description as a string and the importance level as an int. Tune your prompt to tell people of
                obstacles in their path and use the history context to build off of the last output you gave.
                
                Here are some text format instructions:
                Do not repeat phrases at the end of each paragraph.
                
                
                For each item in the output follow these guidelines:
                - The description shouldprovide a clear and concise description of the image, do not make it too long, keep it to two sentences max, for your
                description always include directions and a guess of the exact measure of any important item you describe, also do not start off your response with: the image. In your response make
                sure to respond about whether or not there is space to keep moving forward, if theres anyone or anything they could hit, or if there is any important path blocks
                ahead. Your description should revolve around safety so someone blind can understand the obstacles around them.
                - The importance level should be a number between 1 and 10, where 1 is the least important and 10 is the most important. The importance level should be based on
                the surroundings and tune it based on the description you gave earlier, an example of a one would be a clear path ahead, and an example of a five would be a busy
                crowd, so imagine the streets of the Shibuya Crossing in Tokyo, Japan, or the streets of New York City, New York, USA.
                - The history contains the previous records of what you have responded with so far, if they match what you think you currently see you can use them as a sort of 
                background knowledge to increase the accuracy and effectiveness of your response. The history contains your previous description, importance level, and the image path
                if you want to refer back to it, try not to refer back the previous images all the time, only do it when necessary.
                
                Output a string for the description and an int for the importance level.
                '''
            ),
            ("human", [
                {
                    "type": "image_url",
                    "image_url": {"url": "data:image/jpeg;base64,{image_data}"},
                },
            ]),
        ])
    
    def process_image(self, image_path: str, history: DescriptionHistory) -> Dict[str, Any]:
        """Process an image and return description and importance."""
        try:
            with open(image_path, "rb") as image_file:
                image_data = base64.b64encode(image_file.read()).decode("utf-8")
            
            prompt = self.get_prompt(history)
            
            # Create the chain
            chain = prompt | self.model | self.parser
            
            # Try multiple times in case of temporary failures
            max_attempts = 3
            for attempt in range(max_attempts):
                try:
                    response = chain.invoke({
                        "format_instructions": self.parser.get_format_instructions(),
                        "image_data": image_data,
                        "history": history.get_formatted_history() if history else ""
                    })
                    
                    return {
                        "description": response.description,
                        "importance": response.importance,
                        "success": True
                    }
                except OutputParserException as e:
                    if attempt == max_attempts - 1:
                        logger.error(f"Failed to parse output after {max_attempts} attempts: {str(e)}")
                        raise
                    logger.warning(f"Parsing error (attempt {attempt+1}): {str(e)}. Retrying...")
                    time.sleep(1)  # Brief pause before retry
                except Exception as e:
                    if attempt == max_attempts - 1:
                        logger.error(f"Failed to process image after {max_attempts} attempts: {str(e)}")
                        raise
                    logger.warning(f"Error (attempt {attempt+1}): {str(e)}. Retrying...")
                    time.sleep(1)  # Brief pause before retry
            
        except Exception as e:
            logger.exception(f"Error processing image: {str(e)}")
            return {
                "description": "I couldn't process this image. Please try again.",
                "importance": 1,
                "success": False,
                "error": str(e)
            }

# -----------------------------------------------------------------------------
# API Implementation
# -----------------------------------------------------------------------------

def create_app():
    """Create and configure the Flask application."""
    app = Flask(__name__)
    
    # Load configuration
    app.config.from_object(Config)
    
    # Enable proxy fix if behind a proxy
    app.wsgi_app = ProxyFix(app.wsgi_app)
    
    # Setup CORS
    CORS(app, resources={r"/*": {"origins": Config.CORS_ORIGINS}})
    
    # Ensure upload directory exists
    os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)
    
    # Create services
    ai_service = AIService()
    
    # Set up the request context
    @app.before_request
    def before_request():
        """Initialize resources for each request."""
        g.history = getattr(g, 'history', DescriptionHistory())
    
    # Middleware for API key verification
    def require_api_key(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if not Config.API_KEY:
                # If no API key is configured, skip the check
                return f(*args, **kwargs)
                
            api_key = request.headers.get('X-API-Key')
            if api_key and api_key == Config.API_KEY:
                return f(*args, **kwargs)
            return jsonify({"error": "Unauthorized"}), 401
        return decorated_function
    
    def allowed_file(filename):
        """Check if a file has an allowed extension."""
        return '.' in filename and filename.rsplit('.', 1)[1].lower() in Config.ALLOWED_EXTENSIONS
    
    # Health check endpoint
    @app.route('/health', methods=['GET'])
    def health_check():
        """Health check endpoint."""
        return jsonify({
            "status": "ok",
            "version": "1.0.0"
        })
    
    # API documentation
    @app.route('/')
    def home():
        """API documentation endpoint."""
        return jsonify({
            "api": "Blind-Spot API",
            "version": "1.0.0",
            "description": "API for describing images for visually impaired users",
            "endpoints": {
                "health": "GET /health - Check API health",
                "single_image": "POST /describe - Process a single image",
                "multiple_images": "POST /describe_sequence - Process multiple images in sequence",
                "clear_history": "POST /clear_history - Clear the description history"
            },
            "documentation": "https://github.com/your-repo/blind-spot/docs"
        })
    
    @app.route('/favicon.ico')
    def favicon():
        """Handle favicon requests."""
        return '', 204
    
    @app.route('/describe', methods=['POST'])
    @require_api_key
    def describe_image():
        """Process a single image and return description."""
        try:
            if 'image' not in request.files:
                return jsonify({"error": "No image provided"}), 400
            
            image_file = request.files['image']
            
            if image_file.filename == '':
                return jsonify({"error": "No selected file"}), 400
                
            if not allowed_file(image_file.filename):
                return jsonify({
                    "error": "Invalid file type. Allowed types: " + ", ".join(Config.ALLOWED_EXTENSIONS)
                }), 400
            
            # Create a secure temporary file
            with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as temp_file:
                temp_path = temp_file.name
                image_file.save(temp_path)
            
            try:
                # Process the image
                result = ai_service.process_image(temp_path, g.history)
                
                # Add to history if successful
                if result.get("success", False):
                    g.history.add_response(
                        result['description'], 
                        result['importance'], 
                        secure_filename(image_file.filename)
                    )
                
                return jsonify(result)
            finally:
                # Ensure the temporary file is removed
                if os.path.exists(temp_path):
                    os.unlink(temp_path)
                
        except Exception as e:
            logger.exception(f"Error in describe_image: {str(e)}")
            return jsonify({
                "error": str(e),
                "message": "Failed to process image"
            }), 500
    
    @app.route('/describe_sequence', methods=['POST'])
    @require_api_key
    def describe_sequence():
        """Process multiple images in sequence."""
        try:
            if 'images' not in request.files:
                return jsonify({"error": "No images provided"}), 400
            
            results = []
            image_files = request.files.getlist('images')
            
            if not image_files:
                return jsonify({"error": "Empty file list"}), 400
            
            # Process each image
            for image_file in image_files:
                if image_file.filename == '' or not allowed_file(image_file.filename):
                    continue
                
                # Create a secure temporary file
                with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as temp_file:
                    temp_path = temp_file.name
                    image_file.save(temp_path)
                
                try:
                    # Process the image
                    result = ai_service.process_image(temp_path, g.history)
                    
                    # Add to history if successful
                    if result.get("success", False):
                        g.history.add_response(
                            result['description'], 
                            result['importance'], 
                            secure_filename(image_file.filename)
                        )
                    
                    results.append(result)
                finally:
                    # Ensure the temporary file is removed
                    if os.path.exists(temp_path):
                        os.unlink(temp_path)
            
            return jsonify({
                "results": results,
                "history": [
                    {
                        "description": item["description"],
                        "importance": item["importance"],
                        "image_id": item["image_id"]
                    }
                    for item in g.history.history
                ]
            })
            
        except Exception as e:
            logger.exception(f"Error in describe_sequence: {str(e)}")
            return jsonify({
                "error": str(e),
                "message": "Failed to process image sequence"
            }), 500
    
    @app.route('/clear_history', methods=['POST'])
    @require_api_key
    def clear_history():
        """Clear the description history."""
        g.history.clear()
        return jsonify({"message": "History cleared successfully"})
    
    # Error handlers
    @app.errorhandler(413)
    def request_entity_too_large(error):
        """Handle file too large errors."""
        return jsonify({
            "error": "File too large",
            "message": f"The maximum file size is {Config.MAX_CONTENT_LENGTH / (1024 * 1024)}MB"
        }), 413
    
    @app.errorhandler(404)
    def not_found(error):
        """Handle 404 errors."""
        return jsonify({
            "error": "Not found",
            "message": "The requested resource was not found"
        }), 404
    
    @app.errorhandler(500)
    def server_error(error):
        """Handle 500 errors."""
        logger.exception("Server error")
        return jsonify({
            "error": "Server error",
            "message": "An internal server error occurred"
        }), 500
    
    return app

# -----------------------------------------------------------------------------
# Application entry point
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    app = create_app()
    app.run(host=Config.HOST, port=Config.PORT, debug=Config.DEBUG)