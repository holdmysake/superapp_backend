import os
import pickle
import sys
import json
import numpy as np

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data", "pred")

if len(sys.argv) < 6:
    print(json.dumps({
        "error": "Usage: python predict.py <model_name> <sensor_locations> <normal_pressure> <drop_pressure> <delta_pressure>"
    }), file=sys.stderr)
    sys.exit(1)

model_name = sys.argv[1]
sensor_locations = sys.argv[2:]
normal_pressure = sys.argv[3:]
drop_pressure = sys.argv[4:]
delta_pressure = sys.argv[5:]

model_path = os.path.join(f"{model_name}")

if not os.path.exists(model_path):
    print(json.dumps({"error": f"Model '{model_name}' tidak ditemukan di folder data/"}), file=sys.stderr)
    sys.exit(1)

try:
    model = pickle.load(open(model_path, "rb"))
except Exception as e:
    print(json.dumps({"error": f"Gagal load model: {str(e)}"}), file=sys.stderr)
    sys.exit(1)

try:
    try:
        # Percobaan pertama
        pred = model.predict(sensor_locations, normal_pressure, drop_pressure, "test")
    except Exception as e1:
        print(json.dumps({"warn": f"Prediksi utama gagal, mencoba dengan delta_pressure: {str(e1)}"}), file=sys.stderr)
        # Fallback ke delta_pressure
        titik_list = [float(x) for x in delta_pressure]
        pred = model.predict([titik_list])

    print(f"[DEBUG] Raw prediction: {pred}", file=sys.stderr)

    if hasattr(pred, "__len__"):
        pred_values = np.ravel(pred).tolist()
    else:
        pred_values = [float(pred)]

    print(f"[DEBUG] pred_values: {pred_values}", file=sys.stderr)

except Exception as e:
    print(json.dumps({"error": f"Gagal melakukan prediksi: {str(e)}"}), file=sys.stderr)
    sys.exit(1)

print(json.dumps({
    "result": pred_values
}))
