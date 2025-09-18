import os
import pickle
import sys
import json
import numpy as np

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data", "pred")

if len(sys.argv) < 3:
    print(json.dumps({
        "error": "Usage: python predict.py <model_name> <titik1> <titik2> ... <titikN>"
    }))
    sys.exit(1)

model_name = sys.argv[1]
args = sys.argv[2:]

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

    # ambil elemen pertama saja untuk tahap dev
    if hasattr(pred, "__len__"):
        pred_value = float(np.ravel(pred)[0])
    else:
        pred_value = float(pred)

except Exception as e:
    print(json.dumps({"error": f"Gagal melakukan prediksi: {str(e)}"}))
    sys.exit(1)

if pred_value == 0:
    hasil = "Pipa Aman"
elif pred_value == 26.8:
    hasil = "Tidak Terdapat Fluida yang Mengalir"
else:
    hasil = f"Terjadi di titik {pred_value} KM"

print(json.dumps({
    "result": pred_value
}))