"""Local-only server controls, Expo QR, and redacted logs; no idle polling."""
import streamlit as st
from service_controller import ServiceController

st.set_page_config(page_title='Boses Bantay controls',page_icon='🎛️',layout='wide')

@st.cache_resource
def get_controller():return ServiceController()

controller=get_controller()
st.title('Boses Bantay')
st.caption('LOCAL SERVER CONTROLS · Start or stop only the services you need.')
st.info('Each server is independent. The control panel stays open when you stop the servers.')


def action(function):
    try:
        with st.spinner('Updating services…'):result=function()
        st.session_state.control_notice='\n'.join(result) if isinstance(result,list) else result
        st.session_state.control_error=False
    except Exception as error:
        st.session_state.control_notice=str(error);st.session_state.control_error=True
        try:controller.record_event('panel','ERROR '+str(error))
        except Exception:pass
    st.rerun()


@st.cache_data(show_spinner=False)
def qr_picture(url):return controller.expo_qr(url)


@st.fragment
def log_panel(services):
    st.subheader('Server logs')
    st.caption('All available output streams, grouped by server. Refresh when needed—no automatic page flashing.')
    filters,limit,refresh=st.columns([2,2,1])
    level=filters.selectbox('Log level',['all','errors','warnings'],format_func=lambda x:{'all':'All output','errors':'Errors + context','warnings':'Warnings + context'}[x],key='log-level')
    lines=limit.selectbox('Lines per log file',[100,250,500,1000],index=1,key='log-lines')
    refresh.button('Refresh logs',key='refresh-logs',width='stretch')
    search=st.text_input('Search logs',placeholder='Search an error, route, request ID, or keyword…',key='log-search')
    verbose=st.checkbox('Include Metro bundle-progress events',value=False,key='log-verbose')
    choices=[(s.id,s.title) for s in services]+[('panel','Control panel')]
    records={}
    for key,title in choices:
        try:records[key]=controller.logs(key,lines=lines,level=level,search=search,verbose=verbose)
        except Exception:records[key]={'text':'This log could not be read. The service controls are still available.','files':[],'errors':0,'warnings':0}
    tabs=st.tabs([title for _,title in choices]+['All servers'])
    for tab,(key,title) in zip(tabs,choices):
        with tab:
            record=records[key]
            st.caption(f"{len(record['files'])} log files · {record['errors']} error lines · {record['warnings']} warning lines in the loaded tail")
            if record['files']:st.caption('Sources: '+', '.join(record['files']))
            st.code(record['text'],language='text',height=400)
            st.download_button('Download displayed logs',record['text'],file_name=f'boses-{key}.log',mime='text/plain',key='download-'+key)
    with tabs[-1]:
        combined='\n\n'.join('=== '+title+' ===\n'+records[key]['text'] for key,title in choices)
        st.code(combined,language='text',height=450)
        st.download_button('Download all displayed logs',combined,file_name='boses-all-servers.log',mime='text/plain',key='download-all-logs')
    st.caption('Configured keys and Expo environment values are hidden. Older console-only output cannot be recovered; restart a service from this panel to capture its new output.')


def controls():
    try:
        services=controller.services();snapshot=controller.snapshot()
        states={s.id:controller.status(s,snapshot) for s in services}
    except Exception as error:st.error(str(error));return
    left,right,refresh=st.columns([2,2,1])
    if left.button('▶ Start all',key='start-all',width='stretch',type='primary'):action(controller.start_all)
    if right.button('■ Stop all',key='stop-all',width='stretch',disabled=not any(s['running'] for s in states.values())):action(controller.stop_all)
    if refresh.button('Refresh status / QR',key='refresh',width='stretch'):st.rerun()
    if st.session_state.get('control_notice'):
        if st.session_state.get('control_error'):st.error(st.session_state.control_notice)
        else:st.success(st.session_state.control_notice)
    st.caption('Refresh status after starting a server. Stopping a service interrupts its active requests.')

    with st.container(border=True):
        st.subheader('Scan to open the Expo project')
        try:connection=controller.expo_info(snapshot)
        except Exception:connection={'ready':False,'message':'Expo connection details are not ready. Check its logs below and click Refresh status / QR.'}
        if connection['ready']:
            image,details=st.columns([1,3])
            with image:
                try:st.image(qr_picture(connection['url']),width=264)
                except Exception as error:st.warning(str(error))
            with details:
                st.markdown('**Scan this QR code using Expo Go on your phone.**')
                st.caption('Keep your phone and laptop on the same Wi-Fi. You can also copy this link into Expo Go.')
                st.code(connection['url'],language=None)
                st.caption(f"Live Expo port: {connection['port']}"+(f" · SDK {connection['sdk']}" if connection.get('sdk') else ''))
                st.link_button('Open Expo project page',connection['web_url'])
        else:st.info(connection['message'])

    columns=st.columns(2)
    for index,service in enumerate(services):
        state=states[service.id]
        with columns[index%2]:
            with st.container(border=True):
                title,badge=st.columns([3,2]);title.subheader(service.title)
                color='green' if state['label']=='Running' else 'orange' if state['running'] or state['label']!='Stopped' else 'gray'
                badge.markdown(f":{color}[● {state['label']}]")
                st.caption(service.description);st.code(f'Port {service.port}',language=None)
                start,stop=st.columns(2)
                if start.button('Start',key='start-'+service.id,width='stretch',disabled=state['label']!='Stopped'):action(lambda sid=service.id:controller.start(sid))
                if stop.button('Stop',key='stop-'+service.id,width='stretch',disabled=not state['running']):action(lambda sid=service.id:controller.stop(sid))
                if service.id=='ollama':st.caption('Stopping Ollama pauses the local AI features that use it.')
    log_panel(services)

controls()
