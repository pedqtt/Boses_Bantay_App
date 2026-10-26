"""Read a verified local Expo manifest; generate its QR entirely offline."""
import io
import ipaddress
import json
from pathlib import Path
import shutil
import socket
import subprocess
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from dotenv import dotenv_values
from PIL import Image, ImageDraw


def local_address(project):
    try:
        with socket.socket(socket.AF_INET,socket.SOCK_DGRAM) as route:
            route.connect(('192.0.2.1',80))  # Route lookup only; no packet sent.
            value=route.getsockname()[0]
        if not ipaddress.ip_address(value).is_loopback:return value
    except OSError:pass
    value=urlparse(dotenv_values(project/'.env').get('EXPO_PUBLIC_RAG_API_URL') or '').hostname
    try:
        if value and ipaddress.ip_address(value).is_private and not ipaddress.ip_address(value).is_loopback:return value
    except ValueError:pass
    raise RuntimeError('No laptop Wi-Fi address found. Connect to Wi-Fi and click Refresh.')


def expo_connection(ports,project):
    if not ports:return {'ready':False,'message':'Start Expo below, then click Refresh to show its QR code.'}
    address=local_address(project)
    for port in sorted(ports):
        request=Request(f'http://127.0.0.1:{port}/',headers={
            'Accept':'application/expo+json','Expo-Platform':'android','Expo-Protocol-Version':'1','Host':f'{address}:{port}'})
        try:
            with urlopen(request,timeout=3) as response: manifest=json.load(response)
            # Never expose the rest of the manifest: it may include public-app
            # environment configuration. Only the actual project URI is needed.
            config=manifest.get('extra',{}).get('expoClient',{})
            host=config.get('hostUri')
            if not isinstance(host,str) or not host:raise ValueError('missing_host')
            parsed=urlparse(host if '://' in host else 'http://'+host)
            if not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment:raise ValueError('invalid_host')
            if parsed.hostname in {'localhost','127.0.0.1','::1'}:raise ValueError('phone_cannot_use_loopback')
            return {'ready':True,'url':'exp://'+parsed.netloc,'web_url':'http://'+parsed.netloc,
                    'port':port,'sdk':str(config.get('sdkVersion') or '')}
        except (OSError,ValueError,TypeError,AttributeError):continue
    return {'ready':False,'message':'Expo is starting or its manifest is unavailable. Wait a moment and click Refresh.'}


def qr_png(url,project):
    if not url.startswith(('exp://','exps://')):raise ValueError('Expected an Expo project link.')
    node=shutil.which('node')
    if not node:raise RuntimeError('Node.js is needed to generate the Expo QR code.')
    result=subprocess.run([node,str(Path(__file__).with_name('expo_qr.cjs')),str(project)],
        input=json.dumps({'text':url}),capture_output=True,text=True,timeout=10,
        creationflags=subprocess.CREATE_NO_WINDOW)
    if result.returncode:raise RuntimeError('QR encoder is unavailable. Copy the Expo link or install the project Node dependencies.')
    data=json.loads(result.stdout); size=data['size']; modules=data['modules']
    if not isinstance(size,int) or not 21<=size<=177 or len(modules)!=size*size or any(v not in {0,1} for v in modules):
        raise ValueError('Invalid QR matrix.')
    scale=8; margin=4
    image=Image.new('RGB',((size+margin*2)*scale,)*2,'white'); draw=ImageDraw.Draw(image)
    for row in range(size):
        for col in range(size):
            if modules[row*size+col]:
                x=(col+margin)*scale;y=(row+margin)*scale
                draw.rectangle((x,y,x+scale-1,y+scale-1),fill='black')
    output=io.BytesIO();image.save(output,format='PNG');return output.getvalue()
