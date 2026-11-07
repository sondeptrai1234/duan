# Offline waste model attribution

The project can download `waste_classifier_v5.tflite` from the Hugging Face Space
`ravi799/garbage-detection-using-tflite` on first use in an Android/iOS development
build. The Space repository metadata declares MIT. Keep the attribution and license
notice when redistributing the model. Model reference: https://huggingface.co/spaces/ravi799/garbage-detection-using-tflite

The original user-uploaded `assets/models/waste_model.tflite` remains in the project
for reference. It has 30 output values but no supplied label map, so it is not used
for inference. The alternative model has 30 documented labels in the reference app.
Model performance has not been independently benchmarked by this project.
