import os
import pickle
import sys
import json
import numpy as np
import traceback

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data", "pred")

try:
    if len(sys.argv) < 3:
        raise ValueError("Usage: python predict.py <model_name> <titik1> <titik2> ... <titikN>")

    model_name = sys.argv[1]
    args = sys.argv[2:]

    model_path = os.path.join(DATA_DIR, f"{model_name}.sav")
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model '{model_name}' tidak ditemukan di folder data/")

    try:
        model = pickle.load(open(model_path, "rb"))
    except Exception as e:
        raise RuntimeError(f"Gagal load model: {str(e)}")

    try:
        titik_list = [float(x) for x in args]
    except ValueError:
        raise ValueError("Semua input harus berupa angka")

    try:
        pred = model.predict([titik_list])
        print(f"[DEBUG] Raw prediction: {pred}", file=sys.stderr)

        if hasattr(pred, "__len__"):
            pred_values = np.ravel(pred).tolist()
        else:
            pred_values = [float(pred)]

        print(f"[DEBUG] pred_values: {pred_values}", file=sys.stderr)

    except Exception as e:
        raise RuntimeError(f"Gagal melakukan prediksi: {str(e)}")

except Exception as e:
    # log error detail ke stderr
    print(f"[ERROR] {str(e)}", file=sys.stderr)
    traceback.print_exc(file=sys.stderr)
    # tetap kembalikan result supaya Node.js tidak undefined
    pred_values = []

finally:
    print(json.dumps({
        "result": pred_values
    }))
