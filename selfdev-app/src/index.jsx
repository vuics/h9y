import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client';
import 'semantic-ui-css/semantic.min.css'
import './index.css';
import { BrowserRouter, Route, Routes, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { Loader, } from 'semantic-ui-react'

import conf, { hasProfile } from './conf.js'
import './i18n'
import { IndexContext, usePersistentState, useIndexContext } from './components/IndexContext'
import { ConditionalXmppProvider } from './components/XmppContext'
import UmamiLoader from './components/UmamiLoader'

import Home from './Home'

import Signup from './Signup'
import Login from './Login'
import Forgot from './Forgot'
import Reset from './Reset'
import Logout from './Logout'

import Dash from './Dash'
import Chat from './Chat'
import Map from './Map'
import Hive from './Hive'
import Omni from './Omni'
import Data from './Data'
import O11y from './O11y'
import Apps from './Apps'
import Error from './Error'
import Profile from './Profile'
import Keys from './Keys'
import Vault from './Vault'
import Wallet from './Wallet'
import Settings from './Settings'

import reportWebVitals from './reportWebVitals';

const Test = () => (<div>Test</div>)

export const fetchLoginStatus = async () => {
  const res = await axios.get(`${conf.api.url}/login/status`, {
    withCredentials: true,
  })
  return res.data
}

const Private = ({ children }) => {
  const { user, authChecked } = useIndexContext()
  const navigate = useNavigate()

  useEffect(() => {
    if (authChecked && (!user || !user.email)) {
      navigate('/login', { replace: true })
    }
  }, [user, authChecked, navigate])

  if (!authChecked) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh'
      }}>
        <Loader active inline="centered" size="large" />
      </div>
    )
  }

  if (!user || !user.email) {
    return null
  }

  return children
}



const Secret = ({ children }) => {
  const { user } = useIndexContext()
  const navigate = useNavigate()

  useEffect(() => {
    if (!user || !user.roles.includes('admin')) {
      console.error('Unauthorized. Redirecting to /login')
      navigate('/login', { replace: true })
    }
  }, [user, navigate])

  if (!user || !user.roles.includes('admin')) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh'  // full viewport height
      }}>
        <Loader active inline='centered' size='large' />
      </div>
    )
  }

  return children
}

const root = ReactDOM.createRoot(document.getElementById('root'));

function Index () {
  const navigate = useNavigate()
  const [available, setAvailable] = useState(true)
  const [user, setUser, clearUser] = usePersistentState('user', {});
  const [authChecked, setAuthChecked] = useState(false)
  const [country, setCountry, clearCountry] = usePersistentState('country', '');
  const [cookieConsent, setCookieConsent] = usePersistentState('cookieConsent', null)

  const logIn = (openLogin) => {
    if (available) {
      if (openLogin) {
        navigate('/login')
      } else {
        navigate('/signup')
      }
    } else {
      console.log('navigate to interestForm')
      window.open(conf.interestForm.url, '_blank')
    }
  }

  useEffect(() => {
    let mounted = true
    const bootstrapAuth = async () => {
      try {
        const data = await fetchLoginStatus()
        if (mounted && data.isAuthenticated && data.user?.email) {
          setUser(data.user)
        } else {
          setUser(null)
        }
      } catch (err) {
        console.error('Failed to fetch login status', err)
        setUser(null)
      } finally {
        setAuthChecked(true)
      }
    }
    bootstrapAuth()
    return () => { mounted = false }
  }, [])


  useEffect(() => {
    // Run only once
    // console.log('conf.api.url:', conf.api.url)
    // console.log(`Getting ${conf.api.url}/available`)

    axios.get(`${conf.api.url}/available`)
      .then((response) => {
        if (response.data.status === 'available') {
          console.log('The API is available. You can log in.')
        } else {
          console.warn('Unknown availability status. Join a Whitelist.')
          setAvailable(false)
        }
      })
      .catch(function (error) {
        console.error('error:', error);
        console.warn('The API is unavailable. Join a Whitelist.')
        setAvailable(false)
      })
  }, []);

  useEffect(() => {
    if (conf.protocol.enable && ("registerProtocolHandler" in navigator)) {
      try {
        navigator.registerProtocolHandler(
          conf.protocol.proto,
          `${window.location.origin}/apps?uri=%s`,
          "HyperAgency AgentOS Apps Installer"
        );
        console.log("Protocol handler registered!");
      } catch (err) {
        console.warn("Protocol handler registration failed:", err);
      }
    }
  }, []);

  return (
  <IndexContext.Provider value={{
    available, logIn,
    user, setUser, clearUser,
    authChecked,
    country, setCountry, clearCountry,
    cookieConsent, setCookieConsent,
  }}>
    <ConditionalXmppProvider user={user}>
      <Routes>
        <Route path="/" element={<Home />}/>
        <Route path="/test" element={<Test />}/>

        <Route path="/signup" element={<Signup />}/>
        <Route path="/login" element={<Login />}/>
        <Route path="/forgot" element={<Forgot />}/>
        <Route path="/reset" element={<Reset />}/>
        <Route path="/logout" element={<Logout />}/>

        { conf.dash.enable && (
          <Route path="/dash" element={(<Private> <Dash /> </Private>)}/>
        )}
        { conf.hive.enable && (
          <Route path="/hive" element={(<Private> <Hive/> </Private>)}/>
        )}
        { conf.chat.enable && (
          <Route path="/chat" element={(<Private> <Chat /> </Private>)}/>
        )}
        { conf.map.enable && (
          <Route path="/map" element={(<Private> <Map /> </Private>)}/>
        )}
        { conf.omni.enable && (
          <Route path="/omni" element={(<Private> <Omni/> </Private>)}/>
        )}
        { conf.data.enable && (
          <Route path="/data" element={(<Private> <Data/> </Private>)}/>
        )}
        { conf.o11y.enable && hasProfile(['all', 'h9y', 'logs', 'metrics']) && (
          <Route path="/o11y" element={(<Private> <O11y /> </Private>)}/>
        )}
        { conf.apps.enable && (
          <Route path="/apps" element={(<Private> <Apps/> </Private>)}/>
        )}

        { conf.profile.enable && (
          <Route path='/profile' element={(<Private> <Profile /> </Private>)}/>
        )}
        { conf.keys.enable && (
          <Route path='/keys' element={(<Private> <Keys /> </Private>)}/>
        )}
        { conf.vault.enable && (
          <Route path='/vault' element={(<Private> <Vault /> </Private>)}/>
        )}
        { conf.wallet.enable && (<>
          <Route path='/wallet' element={(<Private> <Wallet/> </Private>)}/>
        </>)}
        { conf.settings.enable && (<>
          <Route path='/settings' element={(<Private> <Settings/> </Private>)}/>
        </>)}

        <Route path="*" element={<Error />}/>
      </Routes>
    </ConditionalXmppProvider>

    <UmamiLoader />
  </IndexContext.Provider>
  )
}

root.render(
  <BrowserRouter>
    <Index/>
  </BrowserRouter>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
