"""Start only the local control UI and open it in the browser."""
import argparse
import json
from pathlib import Path
import subprocess
import sys
import time
from urllib.request import urlopen
import webbrowser

ROOT=Path(__file__).resolve().parent
URL='http://127.0.0.1:8504'

def healthy():
    try:
        with urlopen(URL+'/_stcore/health',timeout=1) as response:
            return response.read().decode().strip()=='ok'
    except Exception:
        return False

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check',action='store_true')
    parser.add_argument('--no-browser',action='store_true')
    args=parser.parse_args()
    if not (ROOT/'control_dashboard.py').is_file(): raise RuntimeError('The control dashboard file is missing.')
    import streamlit
    if args.check:
        print('Control panel setup OK. No services started or stopped.'); return 0
    if not healthy():
        private=ROOT/'.private'; private.mkdir(exist_ok=True)
        with (private/'control-dashboard.log').open('ab') as output:
            process=subprocess.Popen([sys.executable,'-m','streamlit','run',str(ROOT/'control_dashboard.py'),
                '--server.address','127.0.0.1','--server.port','8504','--server.headless','true',
                '--browser.gatherUsageStats','false'],cwd=ROOT,stdout=output,stderr=output,
                creationflags=subprocess.CREATE_NO_WINDOW)
        deadline=time.monotonic()+25
        while not healthy():
            if process.poll() is not None or time.monotonic()>deadline:
                raise RuntimeError('The control UI could not start. Check .private/control-dashboard.log; port 8504 may be in use.')
            time.sleep(.5)
    print('Local server controls: '+URL)
    if not args.no_browser: webbrowser.open(URL)
    return 0

if __name__=='__main__':
    try: sys.exit(main())
    except Exception as error:
        print('Could not open server controls: '+str(error)); sys.exit(1)
