from langchain.output_parsers import PydanticOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.exceptions import OutputParserException
from pydantic import BaseModel, Field
from flask import Flask, request, jsonify, make_response
import traceback
from langchain_core.messages import HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from PIL import Image
import base64, httpx
from dotenv import load_dotenv
from typing import List, Dict
from langchain_core.messages import AIMessage
import os

load_dotenv()
os.environ["GOOGLE_API_KEY"] = os.getenv("GOOGLE_API_KEY")
model = None
parser = None
history = None

## define pydantic maybe kinda???
class description(BaseModel):
    description:str = Field(description="The description of the image, in detail for a blind person to understand.")
    importance:int = Field(description='The importance of the description, 1-5')
    
    # Add schema method for compatibility
    @classmethod
    def schema(cls):
        schema = super().schema()
        return schema

class DescriptionHistory:
    def __init__(self):
        self.history: List[Dict] = []
    
    def add_response(self, description: str, importance: int, image_data: str):
        self.history.append({
            "description": description,
            "importance": importance,
            "image_data": image_data  # Storing base64 for reference (optional)
        })
    
    def get_formatted_history(self) -> str:
        return "\n".join(
            f"Previous description {i+1}: {item['description']} (Importance: {item['importance']})"
            for i, item in enumerate(self.history)
        )
        
def get_parser():
    parser = PydanticOutputParser(pydantic_object=description)
    return parser
## get output
def get_prompt(history: DescriptionHistory = None):
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
                
                Imagine you are the personal assistant for a blind client, you need to describe what is in front of them with detail, in a way that they can understand and in a 
                way that does not leave out any important details about the direction, placement, and proximity of items and people in their area. Try to keep the description to 
                three sentences or less and talk to them casually, be extra cautious when describing to them and do not start off your response with: the image.
                
                For each item in the output follow these guidelines:
                - The description should be in detail and provide a clear and concise description of the image, do not try to make it too long, keep it to two sentences max, for your
                description make sure to include the general direction of any important item you describe, also do not start off your response with: the image. In your response make
                sure to respond about whether or not there is space to keep moving forward, if theres anyone or anything they could hit, or if there is any important path blocks
                ahead.
                - The importance level should be a number between 1 and 10, where 1 is the least important and 10 is the most important. The importance level should be based on
                the surroundings and tune it based on the description you gave earlier, an example of a one would be a clear path ahead, and an example of a five would be a busy
                crowd, so imagine the streets of the Shibuya Crossing in Tokyo, Japan, or the streets of New York City, New York, USA.
                - The history contains the previous records of what you have responded with so far, if they match what you think you currently see you can use them as a sort of 
                background knowledge to increase the accuracy and effectiveness of your response. The history contains your previous description, importance level, and the image path
                if you want to refer back to it, try not to refer back the previous images all the time, only do it when necessary.
                
                Output a string of the description and an int for the importance level.
            '''
        ),
        ("human", [
            {
                "type": "image_url",
                "image_url": {"url": "data:image/jpeg;base64,{image_data}"},
            },
        ]),
    ])

## load in model and api key
def get_model() -> ChatGoogleGenerativeAI:
    model = ChatGoogleGenerativeAI(model="gemini-2.0-flash", api_key=os.getenv("GOOGLE_API_KEY"))
    return model
    
def load_local_image_as_base64(image_path):
        with open(image_path, "rb") as image_file:
            return base64.b64encode(image_file.read()).decode("utf-8")
        
def get_description(image_path: str, history, model, prompt, parser):
    image_data = load_local_image_as_base64(image_path)
    prompt = get_prompt(history)
    chain = prompt | model | parser
    
    response = chain.invoke({
        "format_instructions": parser.get_format_instructions(),
        "image_data": image_data,
        "history": history.history
    })
    
    
    return {"description": response.description, "importance":response.importance}

## send output
app = Flask(__name__)

@app.route('/')
def home():
    return jsonify({
        "message": "Blind-Spot API is running",
        "endpoints": {
            "single_image": "POST /describe",
            "multiple_images": "POST /describe_sequence"
        }
    })

@app.route('/favicon.ico')
def favicon():
    return '', 204
# For single Images
@app.route('/describe', methods=['POST'])
def describe_image():
    try:
        global model
        global parser
        global history
        
        if model is None:
            model = get_model()
        if parser is None:
            parser = get_parser()
        if history is None:
            history = DescriptionHistory()
        
        if 'image' not in request.files:
            return jsonify({"error": "No image provided"}), 400
        
        image_file = request.files['image']
        temp_path = "temp_upload.jpg"
        image_file.save(temp_path)
        
        prompt = get_prompt(history)
        result = get_description(temp_path, history, model, prompt, parser)
        
        os.remove(temp_path)
        return jsonify(result)
        
    except Exception as e:
        traceback.print_exc()
        return jsonify({
            "error": str(e),
            "message": "Failed to process image"
        }), 500
#for multiple images
@app.route('/describe_sequence', methods=['POST'])
def describe_sequence():
    try:
        global model
        global parser
        global history
        
        if model is None:
            model = get_model()
        if parser is None:
            parser = get_parser()
        if history is None:
            history = DescriptionHistory()
        
        if 'images' not in request.files:
            return jsonify({"error": "No images provided"}), 400
        
        results = []
        for i, image_file in enumerate(request.files.getlist('images')):
            temp_path = f"temp_upload_{i}.jpg"
            image_file.save(temp_path)
            
            prompt = get_prompt(history)
            result = get_description(temp_path, history, model, prompt, parser)
            history.add_response(result['description'], result['importance'], temp_path)
            results.append(result)
            
            os.remove(temp_path)
        
        return jsonify({
            "results": results,
            "history": history.history
        })
        
    except Exception as e:
        traceback.print_exc()
        return jsonify({
            "error": str(e),
            "message": "Failed to process image sequence"
        }), 500

if __name__ == "__main__":
    if not os.path.exists('uploads'):
        os.makedirs('uploads')
    
    app.run(host="0.0.0.0", port=5000, debug=True)
