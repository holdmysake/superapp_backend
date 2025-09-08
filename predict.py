import sys
import joblib
import numpy as np

model_path = sys.argv[1]
params = list(map(float, sys.argv[2:]))

model = joblib.load(model_path)

X = np.array([params])

y_pred = model.predict(X)

print(y_pred[0])
