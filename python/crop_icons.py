from PIL import Image, ImageOps
import os

def crop_image(input_path, output_path):
    # Open the image
    img = Image.open(input_path)

    # Convert to RGBA to handle transparency (if any)
    img = img.convert("RGBA")

    # Create a mask based on the non-white pixels
    bbox = img.getbbox()  # Get bounding box of non-white areas

    # Crop to the bounding box
    cropped_img = img.crop(bbox)

    # Resize the cropped image to be square while maintaining the bounding box
    width, height = cropped_img.size
    size = max(width, height)
    
    # Create a new image with a white background
    new_img = Image.new("RGBA", (size, size), (255, 255, 255, 0))
    
    # Paste the cropped image onto the center of the square background
    new_img.paste(cropped_img, ((size - width) // 2, (size - height) // 2))

    # Save the final image
    new_img.save(output_path)

# Folder with PNG files
input_folder = "/home/krogh/src/dong/assets/images/teams"
output_folder = "/home/krogh/src/dong/assets/images/teams"

# Process each image in the folder
for root, _, files in os.walk(input_folder):
    for filename in files:
        if filename.endswith(".png"):
            input_path = os.path.join(root, filename)
            
            # Create the output directory based on the input directory structure
            relative_path = os.path.relpath(root, input_folder)
            output_dir = os.path.join(output_folder, relative_path)
            os.makedirs(output_dir, exist_ok=True)
            
            output_path = os.path.join(output_dir, filename)
            crop_image(input_path, output_path)