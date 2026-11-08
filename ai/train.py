"""Train the BiteBridge intent classifier.

Run from the ai/ folder:
    py train.py
Outputs: model.pkl, vectorizer.pkl, and metrics printed in the terminal.

Two evaluations are printed:
 1. Split test: 20% of dataset.csv (generated phrases, so scores are optimistic).
 2. Holdout test: holdout_test.csv, hand-written lines never used for training.
    Report THIS one as the more honest result.
"""
import joblib
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report
from sklearn.model_selection import train_test_split

RANDOM_STATE = 42

def load(path):
    d = pd.read_csv(path)
    d["text"] = d["text"].str.lower().str.strip()
    return d.drop_duplicates()

df = load("dataset.csv")
hold = load("holdout_test.csv")
print(f"Training rows: {len(df)} | Holdout rows: {len(hold)}")
print(df["intent"].value_counts().to_string(), "\n")

X_train, X_test, y_train, y_test = train_test_split(
    df["text"], df["intent"], test_size=0.2, stratify=df["intent"], random_state=RANDOM_STATE)

def make():
    return (TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 5), sublinear_tf=True),
            LogisticRegression(max_iter=3000, C=10, class_weight="balanced"))

vec, clf = make()
clf.fit(vec.fit_transform(X_train), y_train)

pred = clf.predict(vec.transform(X_test))
print("== 1. Split test (generated data, optimistic) ==")
print("Accuracy:", round(accuracy_score(y_test, pred), 3))

hpred = clf.predict(vec.transform(hold["text"]))
print("\n== 2. Holdout test (hand-written, never trained on) ==")
print("Accuracy:", round(accuracy_score(hold["intent"], hpred), 3))
print(classification_report(hold["intent"], hpred, zero_division=0))

# Final model: train on all generated data (holdout stays untouched).
vec, clf = make()
clf.fit(vec.fit_transform(df["text"]), df["intent"])
joblib.dump(clf, "model.pkl")
joblib.dump(vec, "vectorizer.pkl")
print("Saved model.pkl and vectorizer.pkl")
