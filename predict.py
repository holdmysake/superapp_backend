import os
import pickle
import sys
import json
import numpy as np

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data", "pred", "multi")

if len(sys.argv) < 4:
    print(json.dumps({
        "error": "Usage: python predict.py <model_name> <model_type> <titik1> <titik2> ... <titikN>"
    }))
    sys.exit(1)

model_name = sys.argv[1]
model_type = sys.argv[2]
args = sys.argv[3:]

# if model_type == "multi":
#     model_dir = os.path.join(DATA_DIR, "multi")
# else:
#     model_dir = os.path.join(DATA_DIR, "single")

model_path = os.path.join(DATA_DIR, f"{model_name}.sav")

if not os.path.exists(model_path):
    print(json.dumps({"error": f"Model '{model_name}' tidak ditemukan di folder data/"}))
    sys.exit(1)

try:
    model = pickle.load(open(model_path, "rb"))
except Exception as e:
    print(json.dumps({"error": f"Gagal load model: {str(e)}"}))
    sys.exit(1)

try:
    titik_list = [float(x) for x in args]
except ValueError:
    print(json.dumps({"error": "Semua input harus berupa angka"}))
    sys.exit(1)

try:
    pred = model.predict([titik_list])
    print(f"[DEBUG] Raw prediction: {pred}", file=sys.stderr)

    if hasattr(pred, "__len__"):
        pred_values = np.ravel(pred).tolist()
    else:
        pred_values = [float(pred)]

    print(f"[DEBUG] pred_values: {pred_values}", file=sys.stderr)

except Exception as e:
    print(json.dumps({"error": f"Gagal melakukan prediksi: {str(e)}"}))
    sys.exit(1)

print(json.dumps({
    "result": pred_values
}))