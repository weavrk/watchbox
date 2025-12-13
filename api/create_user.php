<?php
/**
 * Create a new user
 * POST /api/create_user.php
 * Body: { "name": string, "avatar_filename": string }
 * Returns: Created user object
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$input = file_get_contents('php://input');
$data = json_decode($input, true);

if (!$data || !isset($data['name']) || !isset($data['avatar_filename'])) {
    http_response_code(400);
    echo json_encode(['error' => 'name and avatar_filename are required']);
    exit;
}

$name = trim($data['name']);
if (empty($name)) {
    http_response_code(400);
    echo json_encode(['error' => 'name cannot be empty']);
    exit;
}

// Generate user_id from name
$userId = preg_replace('/[^a-zA-Z0-9_-]/', '', strtolower(str_replace(' ', '_', $name)));

// Ensure unique user_id
$usersDir = '../data/users/';
if (!is_dir($usersDir)) {
    mkdir($usersDir, 0755, true);
}

$originalUserId = $userId;
$counter = 1;
while (file_exists($usersDir . $userId . '.json')) {
    $userId = $originalUserId . '_' . $counter;
    $counter++;
}

// Load default streaming services if none provided
$streamingServices = isset($data['streaming_services']) ? $data['streaming_services'] : [];

// If no services provided, use defaults from file
if (empty($streamingServices)) {
    $defaultServicesFile = '../data/default_streaming_services.json';
    if (file_exists($defaultServicesFile)) {
        $defaultServicesContent = file_get_contents($defaultServicesFile);
        $defaultServices = json_decode($defaultServicesContent, true);
        if ($defaultServices && is_array($defaultServices)) {
            $streamingServices = $defaultServices;
        }
    }
}

// Create user object
$user = [
    'user_id' => $userId,
    'name' => $name,
    'avatar_filename' => $data['avatar_filename'],
    'updated_at' => date('c'),
    'items' => [],
    'streaming_services' => $streamingServices,
    'birthday' => isset($data['birthday']) && !empty($data['birthday']) ? $data['birthday'] : ''
];

// Save to file
$filePath = $usersDir . $userId . '.json';
$result = file_put_contents($filePath, json_encode($user, JSON_PRETTY_PRINT));

if ($result === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to create user']);
    exit;
}

http_response_code(201);
echo json_encode($user);

