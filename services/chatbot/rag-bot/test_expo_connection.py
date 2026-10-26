import io
import json
from pathlib import Path
import unittest
from unittest.mock import patch
from PIL import Image
from expo_connection import expo_connection, qr_png
from start_all import PROJECT

class ExpoConnectionTests(unittest.TestCase):
    def test_no_server_has_no_stale_qr(self):
        self.assertFalse(expo_connection(set(),Path('.'))['ready'])

    def test_uses_live_manifest_and_phone_reachable_host(self):
        body={'extra':{'expoClient':{'hostUri':'192.168.1.5:8082','sdkVersion':'57.0.0'}}}
        with patch('expo_connection.local_address',return_value='192.168.1.5'),patch('expo_connection.urlopen',return_value=io.BytesIO(json.dumps(body).encode())) as read:
            result=expo_connection({8082},Path('.'))
        self.assertEqual(result['url'],'exp://192.168.1.5:8082')
        self.assertEqual(read.call_args.args[0].get_header('Host'),'192.168.1.5:8082')

    def test_loopback_manifest_not_shown_to_phone(self):
        body={'extra':{'expoClient':{'hostUri':'127.0.0.1:8081'}}}
        with patch('expo_connection.local_address',return_value='192.168.1.5'),patch('expo_connection.urlopen',return_value=io.BytesIO(json.dumps(body).encode())):
            self.assertFalse(expo_connection({8081},Path('.'))['ready'])

    def test_offline_qr_encoder_creates_black_white_png_with_quiet_border(self):
        png=qr_png('exp://192.168.1.5:8081',PROJECT)
        image=Image.open(io.BytesIO(png))
        self.assertEqual(image.width,image.height)
        self.assertEqual(image.getpixel((0,0)),(255,255,255))
        self.assertEqual(image.getpixel((32,32)),(0,0,0))

if __name__=='__main__':unittest.main()
