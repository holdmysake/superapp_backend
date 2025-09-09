import os, pickle, sys, json

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "data", "bjg_tpn.sav")

model = pickle.load(open(MODEL_PATH, "rb"))

if len(sys.argv) != 5:
    print(json.dumps({"error": "Usage: python predict.py <titik1> <titik2> <titik3> <titik4>"}))
    sys.exit(1)

titik1 = float(sys.argv[1])
titik2 = float(sys.argv[2])
titik3 = float(sys.argv[3])
titik4 = float(sys.argv[4])

pred = model.predict([[titik1, titik2, titik3, titik4]])[0]

if pred == 0:
    hasil = "Pipa Aman"
elif pred == 26.8:
    hasil = "Tidak Terdapat Fluida yang Mengalir"
else:
    hasil = f"Terjadi di titik {pred} KM"

print(json.dumps({
    "prediction": float(pred),
    "message": hasil
}))