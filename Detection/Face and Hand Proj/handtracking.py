
import cv2
import mediapipe as mp
import math
import time

BaseOptions = mp.tasks.BaseOptions

FaceDetector = mp.tasks.vision.FaceDetector
FaceDetectorOptions = mp.tasks.vision.FaceDetectorOptions

HandLandmarker = mp.tasks.vision.HandLandmarker
HandLandmarkerOptions = mp.tasks.vision.HandLandmarkerOptions

VisionRunningMode = mp.tasks.vision.RunningMode


face_options = FaceDetectorOptions(
    base_options=BaseOptions(
        model_asset_path="blaze_face_short_range.tflite"
    ),
    running_mode=VisionRunningMode.IMAGE,
    min_detection_confidence=0.6
)

hand_options = HandLandmarkerOptions(
    base_options=BaseOptions(
        model_asset_path="hand_landmarker.task"
    ),
    running_mode=VisionRunningMode.IMAGE,
    num_hands=2,
    min_hand_detection_confidence=0.65,
    min_hand_presence_confidence=0.65,
    min_tracking_confidence=0.65
)

face_detector = FaceDetector.create_from_options(face_options)
hand_detector = HandLandmarker.create_from_options(hand_options)

cap = cv2.VideoCapture(0)

cv2.namedWindow("AR", cv2.WINDOW_NORMAL)
cv2.resizeWindow("AR", 1280, 720)

pulse_start = 0
pulse_x = 0
pulse_y = 0


def distance(a, b):
    return math.sqrt(
        (a[0] - b[0]) ** 2 +
        (a[1] - b[1]) ** 2
    )


while True:

    ret, frame = cap.read()

    if not ret:
        break

    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

    mp_image = mp.Image(
        image_format=mp.ImageFormat.SRGB,
        data=rgb
    )

    face_result = face_detector.detect(mp_image)
    hand_result = hand_detector.detect(mp_image)

    faces = []

    for detection in face_result.detections:

        box = detection.bounding_box

        x = box.origin_x
        y = box.origin_y
        w = box.width
        h = box.height

        faces.append((x, y, w, h))

    gesture = None
    hand_points = []

    for hand in hand_result.hand_landmarks:

        h_img, w_img, _ = frame.shape

        points = []

        for landmark in hand:

            x = int(landmark.x * w_img)
            y = int(landmark.y * h_img)

            points.append((x, y))

        hand_points.append(points)

        connections = [
            (0,1),(1,2),(2,3),(3,4),
            (0,5),(5,6),(6,7),(7,8),
            (0,9),(9,10),(10,11),(11,12),
            (0,13),(13,14),(14,15),(15,16),
            (0,17),(17,18),(18,19),(19,20),
            (5,9),(9,13),(13,17)
        ]

        for a, b in connections:
            cv2.line(
                frame,
                points[a],
                points[b],
                (0,255,0),
                2
            )

        for x, y in points:
            cv2.circle(
                frame,
                (x, y),
                4,
                (0,255,0),
                -1
            )

        palm = distance(points[0], points[9])

        thumb = distance(points[4], points[2])
        index = distance(points[8], points[5])
        middle = distance(points[12], points[9])
        ring = distance(points[16], points[13])
        pinky = distance(points[20], points[17])

        thumb_extended = thumb > palm * 0.55
        index_extended = index > palm * 0.65
        middle_extended = middle > palm * 0.65
        ring_extended = ring > palm * 0.60
        pinky_extended = pinky > palm * 0.55

        extended = [
            thumb_extended,
            index_extended,
            middle_extended,
            ring_extended,
            pinky_extended
        ]

        # OPEN PALM

        if all(extended):

            gesture = "PALM"

            pulse_x = points[9][0]
            pulse_y = points[9][1]

            if time.time() - pulse_start > 0.8:
                pulse_start = time.time()

        # THUMBS UP

        elif (
            thumb_extended
            and not index_extended
            and not middle_extended
            and not ring_extended
            and not pinky_extended
        ):

            gesture = "THUMBS UP"

    # FACE DISPLAY

    if gesture != "TWO":

        for i, (x, y, w, h) in enumerate(faces):

            cv2.rectangle(
                frame,
                (x, y),
                (x + w, y + h),
                (0,255,0),
                2
            )

            cv2.putText(
                frame,
                f"Face {i}",
                (x, max(y - 10, 25)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                (0,255,0),
                2
            )

    # JAI BABU

    if gesture == "THUMBS UP":

        for x, y, w, h in faces:

            text = "JAI BABU"

            size = cv2.getTextSize(
                text,
                cv2.FONT_HERSHEY_SIMPLEX,
                1.2,
                3
            )[0]

            tx = x + (w - size[0]) // 2
            ty = max(y - 25, 40)

            cv2.putText(
                frame,
                text,
                (tx, ty),
                cv2.FONT_HERSHEY_SIMPLEX,
                1.2,
                (255,255,255),
                5
            )

            cv2.putText(
                frame,
                text,
                (tx, ty),
                cv2.FONT_HERSHEY_SIMPLEX,
                1.2,
                (0,0,255),
                3
            )

    # IRON MAN PULSE

    if gesture == "PALM":

        elapsed = time.time() - pulse_start

        radius = int((elapsed * 500) % 300)

        overlay = frame.copy()

        cv2.circle(
            overlay,
            (pulse_x, pulse_y),
            radius,
            (0,180,255),
            8
        )

        cv2.circle(
            overlay,
            (pulse_x, pulse_y),
            max(radius - 25, 1),
            (255,255,255),
            3
        )

        cv2.addWeighted(
            overlay,
            0.7,
            frame,
            0.3,
            0,
            frame
        )

        cv2.circle(
            frame,
            (pulse_x, pulse_y),
            35,
            (255,255,255),
            -1
        )

        cv2.circle(
            frame,
            (pulse_x, pulse_y),
            25,
            (0,180,255),
            -1
        )

    # UI

    cv2.putText(
        frame,
        f"Faces: {len(faces)}",
        (20,40),
        cv2.FONT_HERSHEY_SIMPLEX,
        1,
        (0,255,0),
        2
    )

    cv2.putText(
        frame,
        f"Hands: {len(hand_points)}",
        (20,80),
        cv2.FONT_HERSHEY_SIMPLEX,
        1,
        (0,255,0),
        2
    )

    if gesture:

        cv2.putText(
            frame,
            gesture,
            (20,120),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.9,
            (0,255,255),
            2
        )

    cv2.imshow("AR", frame)

    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

cap.release()

face_detector.close()
hand_detector.close()

cv2.destroyAllWindows()