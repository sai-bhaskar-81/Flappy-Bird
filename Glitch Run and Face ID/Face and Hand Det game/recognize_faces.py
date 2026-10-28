import cv2
import mediapipe as mp

recognizer = cv2.face.LBPHFaceRecognizer_create()
recognizer.read("face_model.yml")

BaseOptions = mp.tasks.BaseOptions
FaceDetector = mp.tasks.vision.FaceDetector
FaceDetectorOptions = mp.tasks.vision.FaceDetectorOptions
VisionRunningMode = mp.tasks.vision.RunningMode

options = FaceDetectorOptions(
    base_options=BaseOptions(
        model_asset_path="blaze_face_short_range.tflite"
    ),
    running_mode=VisionRunningMode.IMAGE,
    min_detection_confidence=0.5
)

detector = FaceDetector.create_from_options(options)

cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)

while True:

    ret, frame = cap.read()

    if not ret:
        break

    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

    image = mp.Image(
        image_format=mp.ImageFormat.SRGB,
        data=rgb
    )

    result = detector.detect(image)

    for detection in result.detections:

        box = detection.bounding_box

        x = max(0, box.origin_x)
        y = max(0, box.origin_y)
        w = box.width
        h = box.height

        x2 = min(frame.shape[1], x + w)
        y2 = min(frame.shape[0], y + h)

        if x2 <= x or y2 <= y:
            continue

        face = frame[y:y2, x:x2]

        gray = cv2.cvtColor(face, cv2.COLOR_BGR2GRAY)
        gray = cv2.resize(gray, (200, 200))

        person_id, confidence = recognizer.predict(gray)

        if confidence < 80:
            text = f"ID: {person_id}"
        else:
            text = "Unknown"

        cv2.rectangle(
            frame,
            (x, y),
            (x2, y2),
            (0, 255, 0),
            2
        )

        cv2.putText(
            frame,
            f"{text}  {confidence:.0f}",
            (x, y - 10),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (0, 255, 0),
            2
        )

    cv2.imshow("Face Recognition", frame)

    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

cap.release()
cv2.destroyAllWindows()
detector.close()