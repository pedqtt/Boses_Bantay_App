"""Start Ollama, the mobile chatbot API, and Expo from one command."""
import argparse
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import time
from urllib.parse import urlparse
from urllib.request import urlopen

from dotenv import dotenv_values, set_key

BACKEND = Path(__file__).resolve().parent
PROJECT = BACKEND.parents[2]


def read_url(url):
    try:
        with urlopen(url, timeout=2) as response:
            return response.read().decode('utf-8')
    except Exception:
        return None


def wait_ready(url, expected, process, seconds=40):
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        body = read_url(url)
        if body and expected(body):
            return
        if process.poll() is not None:
            break
        time.sleep(.5)
    raise RuntimeError('Service did not start. See the startup logs in services/chatbot/rag-bot/.private.')


def hidden_process(arguments, log_name, cwd=BACKEND, env=None):
    private = BACKEND / '.private'
    private.mkdir(exist_ok=True)
    env=(env or os.environ).copy()
    env['PYTHONUNBUFFERED']='1'
    with (private / log_name).open('ab') as log:
        return subprocess.Popen(arguments, cwd=cwd, stdout=log, stderr=log,
                                creationflags=subprocess.CREATE_NO_WINDOW, env=env)


def api_ready(body):
    try:
        return json.loads(body).get('service') == 'boses-rag-mobile'
    except (ValueError, AttributeError):
        return False


def voice_settings(environment):
    directory = Path(environment.get('WHISPER_SERVICE_DIR') or PROJECT.parent / 'whisper-server')
    candidates = [Path(environment['WHISPER_PYTHON'])] if environment.get('WHISPER_PYTHON') else [directory / 'venv/Scripts/python.exe', directory / '.venv/Scripts/python.exe']
    python = next((candidate for candidate in candidates if candidate.is_file()), None)
    if python is None or not (directory / 'app.py').is_file():
        raise RuntimeError('Whisper service/environment is missing. Set WHISPER_SERVICE_DIR and optionally WHISPER_PYTHON in the backend .env.')
    return directory, python


def voice_ready(body):
    try:
        value = json.loads(body)
        return value.get('status') == 'ok' and isinstance(value.get('model'), str)
    except (ValueError, AttributeError):
        return False


def ensure_voice(environment, key):
    url = environment.get('VOICE_UPSTREAM_URL') or 'http://127.0.0.1:8000'
    target = urlparse(url)
    if target.hostname not in {'127.0.0.1','localhost'} or target.scheme != 'http' or target.path not in {'','/'}:
        raise RuntimeError('VOICE_UPSTREAM_URL must point to the local Whisper worker.')
    existing = read_url(url.rstrip('/') + '/health')
    if existing:
        if not voice_ready(existing):
            raise RuntimeError('The Whisper port belongs to another service.')
        print('Whisper transcription is already running.')
        return
    directory, python = voice_settings(environment)
    env = os.environ.copy()
    env['WHISPER_API_KEY'] = environment.get('VOICE_UPSTREAM_API_KEY') or key
    env['OLLAMA_MODEL'] = environment.get('VOICE_LLM_MODEL') or 'qwen3:8b'
    # Existing local model cache avoids a model download during startup.
    env['HF_HUB_OFFLINE'] = '1'
    for name in ['WHISPER_MODEL','WHISPER_DEVICE','WHISPER_COMPUTE_TYPE','WHISPER_LANGUAGE']:
        if environment.get(name): env[name] = environment[name]
    print('Starting Whisper transcription locally. Waiting for the cached model...')
    process = hidden_process([str(python),'-m','uvicorn','app:app','--host','127.0.0.1','--port',str(target.port or 8000)], 'startup-whisper.log', cwd=directory, env=env)
    wait_ready(url.rstrip('/')+'/health', voice_ready, process, seconds=180)
    print('Whisper transcription is ready.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Check setup without starting services or changing files.')
    parser.add_argument('--tunnel', action='store_true', help='Use an Expo tunnel on port 8082 to bypass LAN bundle-download failures.')
    args = parser.parse_args()
    backend_env = dotenv_values(BACKEND / '.env')
    mobile_env = dotenv_values(PROJECT / '.env')
    node = shutil.which('node')
    ollama = shutil.which('ollama') or str(Path(os.environ.get('LOCALAPPDATA', '')) / 'Programs/Ollama/ollama.exe')
    expo = PROJECT / 'node_modules/expo/bin/cli'
    if not node or not expo.is_file():
        raise RuntimeError('Node/Expo is missing. Install Node.js and run npm install in the project folder.')
    if not Path(ollama).is_file():
        raise RuntimeError('Ollama is missing. Install Ollama first.')
    if not (BACKEND / 'mobile_api.py').is_file():
        raise RuntimeError('mobile_api.py is missing from the chatbot folder.')
    key = backend_env.get('RAG_API_KEY', '')
    if len(key) < 24 or mobile_env.get('EXPO_PUBLIC_RAG_API_KEY') != key:
        raise RuntimeError('The backend RAG_API_KEY and mobile EXPO_PUBLIC_RAG_API_KEY must match (at least 24 characters).')
    if not backend_env.get('SUPABASE_URL') or not backend_env.get('SUPABASE_SERVICE_ROLE_KEY'):
        raise RuntimeError('The chatbot backend .env needs its Supabase URL and service-role key.')
    host = (backend_env.get('OLLAMA_HOST') or 'http://localhost:11434').rstrip('/')
    mobile_url = urlparse(mobile_env.get('EXPO_PUBLIC_RAG_API_URL') or '')
    hosted_api = mobile_url.scheme == 'https' and bool(mobile_url.hostname)
    if not hosted_api and (mobile_url.scheme != 'http' or mobile_url.port != 8503 or not mobile_url.hostname):
        raise RuntimeError('Set EXPO_PUBLIC_RAG_API_URL to a Railway HTTPS URL or http://<laptop-IP>:8503.')
    if args.check:
        voice_settings(backend_env)
        print('Setup OK: Node, Expo, Ollama, Python, and local chatbot configuration found.')
        print('No services started and no configuration changed.')
        return 0

    # Detect the local route without sending a network packet. Refresh the local
    # URL before Expo reads .env, so a Wi-Fi IP change does not strand the phone.
    try:
        if hosted_api:
            print('Using hosted chatbot and transcription API: ' + mobile_url.scheme + '://' + mobile_url.netloc)
        else:
            with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as route:
                route.connect(('192.0.2.1', 80))
                lan_ip = route.getsockname()[0]
        if not hosted_api and lan_ip and not lan_ip.startswith('127.'):
            current_url = f'http://{lan_ip}:8503'
            if current_url != mobile_env['EXPO_PUBLIC_RAG_API_URL']:
                set_key(str(PROJECT / '.env'), 'EXPO_PUBLIC_RAG_API_URL', current_url)
                print('Updated local chatbot address: ' + current_url)
    except OSError:
        print('Could not detect Wi-Fi address; keeping the existing local chatbot URL.')

    tags = read_url(host + '/api/tags')
    if not tags:
        if urlparse(host).hostname not in {'localhost', '127.0.0.1'}:
            raise RuntimeError('The configured remote Ollama host is offline. Start that server first.')
        print('Starting Ollama...')
        ollama_env = os.environ.copy()
        ollama_env['OLLAMA_HOST'] = host
        process = hidden_process([ollama, 'serve'], 'startup-ollama.log', env=ollama_env)
        wait_ready(host + '/api/tags', lambda text: 'models' in json.loads(text), process)
        tags = read_url(host + '/api/tags')
    else:
        print('Ollama is already running.')
    installed = {m['name'] for m in json.loads(tags)['models']}
    missing = [name for name in ['qwen3:8b', 'nomic-embed-text']
               if name not in installed and name + ':latest' not in installed]
    if missing:
        raise RuntimeError('Missing Ollama models. Run: ' + ' and '.join('ollama pull ' + name for name in missing))

    ensure_voice(backend_env, key)

    health = read_url('http://127.0.0.1:8503/health')
    if health is not None and not api_ready(health):
        raise RuntimeError('Port 8503 belongs to another service. Close that service or change its port.')
    if not health:
        print('Starting mobile chatbot API...')
        api_env = os.environ.copy()
        for name in ['RAG_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'OLLAMA_HOST','VOICE_UPSTREAM_URL','VOICE_UPSTREAM_API_KEY']:
            if backend_env.get(name):
                api_env[name] = backend_env[name]
        process = hidden_process([sys.executable, str(BACKEND / 'mobile_api.py'), '--host', '0.0.0.0', '--port', '8503'], 'startup-mobile-api.log', env=api_env)
        wait_ready('http://127.0.0.1:8503/health', api_ready, process)
    else:
        print('Mobile chatbot API is already running.')

    expo_port = 8082 if args.tunnel else 8081
    status = read_url(f'http://127.0.0.1:{expo_port}/status')
    if status and 'packager-status:running' in status:
        print(f'Expo is already running on port {expo_port}. Use its current project QR code instead of the old recent-project entry.')
        return 0
    print('\nStarting Expo. Keep this window open and use the same Wi-Fi on your phone.')
    print('Ctrl+C stops Expo; Ollama and the chatbot API stay available.\n')
    env = os.environ.copy()
    # Let Expo read the freshly updated local .env instead of a stale shell URL.
    env.pop('EXPO_PUBLIC_RAG_API_URL', None)
    env.pop('EXPO_PUBLIC_RAG_API_KEY', None)
    env.pop('REACT_NATIVE_PACKAGER_HOSTNAME', None)
    env.pop('EXPO_PACKAGER_PROXY_URL', None)
    if args.tunnel:
        print('Tunnel mode: scan the NEW QR code below. The old LAN project link will not use this tunnel.')
        arguments = ['start', '--tunnel', '--port', '8082', '--max-workers', '2']
    else:
        arguments = ['start', '--lan', '--port', '8081', '--max-workers', '2']
    # Keep the Metro cache: clearing it on every launch forces the phone to
    # wait for a full rebuild and makes initial-download timeouts more likely.
    return subprocess.call([node, str(expo), *arguments], cwd=PROJECT, env=env)


if __name__ == '__main__':
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print('\nExpo stopped. You can run the launcher again anytime.')
        sys.exit(0)
    except Exception as error:
        print('\nCould not start Boses Bantay: ' + str(error))
        sys.exit(1)
