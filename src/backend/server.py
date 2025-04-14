from langchain.output_parsers import PydanticOutputParser
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, Field
from langchain_core.messages import HumanMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from PIL import Image
import base64, httpx
from dotenv import load_dotenv
import os

load_dotenv()
os.environ["GOOGLE_API_KEY"] = os.getenv("GOOGLE_API_KEY")

## load in model and api key
def load_model() -> ChatGoogleGenerativeAI:
    model = ChatGoogleGenerativeAI(model="gemini-2.0-flash", api_key=os.getenv("GOOGLE_API_KEY"))
    return model
    
## define pydantic maybe kinda???
class description(BaseModel):
    description:str = Field(description="The description of the image, in detail for a blind person to understand.")
    importance:int = Field(description='The importance of the description, 1-5')
    
    # Add schema method for compatibility
    @classmethod
    def schema(cls):
        schema = super().schema()
        # You might need to adjust this based on exact requirements
        return schema
    
def get_parser():
    parser = PydanticOutputParser(pydantic_object=description)
    return parser

## load in image

## get output
def get_prompt():
    prompt = ChatPromptTemplate.from_messages([
        ("system", 
            '''
                You are to return the description of an image and the importance of the image based on what you can detect.
                The format instructions for the model are:
                {format_instructions}
                
                Imagine you are the personal assistant for a blind client, you need to describe what is in front of them with detail, in a way that they can understand and in a 
                way that does not leave out any important details about the direction, placement, and proximity of items and people in their area. Try to keep the description to 
                three sentences or less and talk to them casually, be extra cautious when describing to them and do not start off your response with: the image.
                
                For each item in the output follow these guidelines:
                - The description should be in detail and provide a clear and concise description of the image, do not try to make it too long, keep it to two sentences max, for your
                description make sure to include the general direction of any important item you describe, also do not start off your response with: the image. In your response make
                sure to respond about whether or not there is space to keep moving forward, if theres anyone or anything they could hit, or if there is any important path blocks
                ahead.
                - The importance level should be a number between 1 and 5, where 1 is the least important and 5 is the most important. The importance level should be based on
                the surroundings and tune it based on the description you gave earlier, an example of a one would be a clear path ahead, and an example of a five would be a busy
                crowd, so imagine the streets of the Shibuya Crossing in Tokyo, Japan, or the streets of New York City, New York, USA.
                
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
    return prompt

def load_local_image_as_base64(image_path):
        with open(image_path, "rb") as image_file:
            return base64.b64encode(image_file.read()).decode("utf-8")
        
def get_description(path_to_image):
    parser = get_parser()
    prompt = get_prompt()
    model = load_model()
    chain = prompt | model | parser

    # Get the base64 encoded image data
    image_data = load_local_image_as_base64(path_to_image)

    # Run the chain and print the result
    response = chain.invoke({
        "format_instructions": parser.get_format_instructions(),
        "image_data": image_data
    })

    print(response)

## send output
get_description('example3.jpg')