---
title: Detekcja Zachowań - research 25.11.25

---

# Propozycje rozwoju projektu
## TLDR
Dokument opisuje możliwe sposoby na realizację projektu detekcji zachowań na kamerach monitoringu politechniki warszawskiej.

## Detekcja zachowań
### 1. Detekcja prostych zachowań
- Detekcja prostych zachowań tj.  pajacyki, bieg, podskoki
- Wykorzystanie modelu yolo do śledzenia punktów kluczowych osób na nagraniach
- Wytrenowanie sieci neuronowej do detekcji czy w danej ramce człowiek wykonuje pajacyki czy nie
- Wykorzystanie filmów z youtube pokazujące osoby robiące pajacyki do trenowania modelu, mnóstwo danych, łatwy dostęp.

### 2. Wykrywanie sytuacji niebezpiecznych
- Dużo zbiorów na roboflow
- Są gotowe modele ale radzą sobie dość kiepsko
![image](https://hackmd.io/_uploads/B131oP7Z-g.png)
- Najpopularniejszy [dataset](https://universe.roboflow.com/dinesh-nariani-rmnpr/violence-not_violence-ziv7b)

### 3. Trzeba zaproponować jeszcze inne ścieżki

## Anonimizacja twarzy
tutaj kilka krótkich punktów na podstawie Analiza Możliwości.ipynb

## Wykrywanie tablic rejestracyjnych
tutaj kilka krótkich punktów na podstawie Analiza Możliwości.ipynb