# caption_server.py

from flask import Flask, request, jsonify
from transformers import VisionEncoderDecoderModel, ViTImageProcessor, AutoTokenizer
import torch
from PIL import Image

app = Flask(__name__)

# Load the model, processor, and tokenizer when the server starts.
model_name = "nlpconnect/vit-gpt2-image-captioning"
model = VisionEncoderDecoderModel.from_pretrained(model_name)
feature_extractor = ViTImageProcessor.from_pretrained(model_name)
tokenizer = AutoTokenizer.from_pretrained(model_name)

# Use GPU if available.
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model.to(device)

@app.route("/caption", methods=["POST"])
def caption():
    if "image" not in request.files:
        return jsonify({"error": "No image uploaded"}), 400

    file = request.files["image"]
    image = Image.open(file.stream).convert("RGB")
    pixel_values = feature_extractor(images=image, return_tensors="pt").pixel_values.to(device)

    # Generate caption using beam search (you can adjust max_length, num_beams as needed)
    output_ids = model.generate(pixel_values, max_length=16, num_beams=4)
    caption_text = tokenizer.decode(output_ids[0], skip_special_tokens=True)

    return jsonify({"caption": caption_text})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001)
