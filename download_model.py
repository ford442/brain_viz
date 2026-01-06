import requests

url = "https://github.com/onnx/models/raw/main/validated/vision/classification/squeezenet/model/squeezenet1.1.onnx"
output_path = "public/squeezenet1.1.onnx"

print(f"Downloading {url} to {output_path}...")
try:
    response = requests.get(url, allow_redirects=True)
    if response.status_code == 200:
        with open(output_path, "wb") as f:
            f.write(response.content)
        print("Download complete.")
    else:
        print(f"Failed to download. Status code: {response.status_code}")
except Exception as e:
    print(f"Error: {e}")
