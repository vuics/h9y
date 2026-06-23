import React, { useEffect, useState, useCallback, useRef } from 'react';
import { isEmpty } from 'lodash'
import axios from 'axios'
import Cropper from 'react-easy-crop'
import {
  Form,
  Container,
  Segment,
  Loader,
  Message,
  Button,
  Icon,
  Header,
  Divider,
  Image,
  Input,
  Modal,
  // Dropdown,
  // Label
  // Progress,
} from 'semantic-ui-react'
import { useTranslation } from 'react-i18next'

import Menubar from './components/Menubar'
import { useIndexContext } from './components/IndexContext'
import { CountryFormField } from './components/Countries'
import conf from './conf'

/**
 * Creates a cropped image from a source image and crop pixel data.
 * @param {string} imageSrc - The source image in base64 format.
 * @param {object} pixelCrop - The pixel crop data from react-easy-crop.
 * @param {number} width - The desired output width.
 * @param {number} height - The desired output height.
 * @returns {Promise<string>} A promise that resolves with the cropped image in base64 format.
 */
export const getCroppedImg = (imageSrc, pixelCrop, width = 256, height = 256) => {
  return new Promise((resolve, reject) => {
    if (!pixelCrop || !imageSrc) {
      reject(new Error('Invalid crop data or image source.'));
      return;
    }

    const image = new window.Image();
    image.src = imageSrc;
    image.crossOrigin = 'anonymous';

    image.onerror = () => reject(new Error('Failed to load image.'));
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          throw new Error('Could not get canvas context.');
        }

        ctx.drawImage(
          image,
          pixelCrop.x,
          pixelCrop.y,
          pixelCrop.width,
          pixelCrop.height,
          0,
          0,
          width,
          height
        );

        canvas.toBlob(blob => {
          if (!blob) {
            return reject(new Error('Canvas is empty.'));
          }
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        }, 'image/png');
      } catch (e) {
        reject(e);
      }
    };
  });
};

export function AvatarUploader() {
  const { t } = useTranslation('Profile')
  const [avatar, setAvatar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  // State for cropping modal
  const [imageSrc, setImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    const fetchAvatar = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await axios.get(`${conf.api.url}/profile/avatar`, {
          withCredentials: true,
        });
        if (res.data?.avatar) {
          setAvatar(res.data.avatar);
        }
      } catch (err) {
        console.error('Failed to load avatar', err);
        setError('Could not load your avatar.');
      } finally {
        setLoading(false);
      }
    };

    fetchAvatar();
  }, []);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        setImageSrc(reader.result);
        setModalOpen(true);
      };
      reader.readAsDataURL(file);
    } else {
        setError("Please select a valid image file.");
    }
  };

  const onCropComplete = useCallback((_, croppedPixels) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const uploadAvatar = async (base64Image) => {
    setUploading(true);
    setError(null);
    try {
      const res = await axios.post(
        `${conf.api.url}/profile/avatar`,
        { avatar: base64Image },
        {
          headers: { 'Content-Type': 'application/json' },
          withCredentials: true,
        }
      );
      // If backend sends back the new URL/base64, use it. Otherwise, use the one we just created.
      setAvatar(res?.data?.avatar || base64Image);
    } catch (err) {
      console.error('Failed to upload avatar', err);
      setError('Failed to upload avatar. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleCropSave = async () => {
    if (!imageSrc || !croppedAreaPixels) {
      console.error('Missing crop data', { imageSrc, croppedAreaPixels });
      setError('Could not process the image. Please try again.');
      return;
    }

    try {
      const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels);
      if (!croppedImage) throw new Error('Cropped image is null');

      setAvatar(croppedImage);
      setModalOpen(false);
      await uploadAvatar(croppedImage); // Pass the new image directly
    } catch (err) {
      console.error('Error cropping image', err);
      setError('There was an error while cropping the image.');
    }
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setImageSrc(null);
    setZoom(1);
    setCrop({ x: 0, y: 0 });
  };

  return (
    <Segment padded textAlign="center" style={{ maxWidth: 400, margin: '2rem auto' }}>
      <Header as='h3'>
        <Icon name="user circle" />
        {t('Avatar')}
      </Header>

      {loading ? (
        <Loader active inline="centered" content={t("Loading...")} />
      ) : (
        <Image
          src={avatar || 'https://react.semantic-ui.com/images/wireframe/square-image.png'}
          size="small"
          circular
          centered
          style={{ marginBottom: '1rem' }}
        />
      )}

      {error && <Message negative onDismiss={() => setError(null)} content={error} />}

      <Input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        ref={fileInputRef}
        style={{ display: 'none' }}
      />

      <Button
        onClick={() => fileInputRef.current && fileInputRef.current.inputRef.current.click()}
        loading={uploading}
        disabled={uploading}
        color={conf.style.color0}
        icon labelPosition='left'
      >
        <Icon name="upload" />
        {uploading ? t('Uploading...') : t('Upload') }
      </Button>

      <Modal open={modalOpen} onClose={handleCloseModal} size="small" closeIcon>
        <Modal.Header>Crop Your New Avatar</Modal.Header>
        <Modal.Content>
          <div style={{ position: 'relative', width: '100%', height: 400, background: '#333' }}>
            {imageSrc && (
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                cropShape="round"
              />
            )}
          </div>
        </Modal.Content>
        <Modal.Actions>
          <Button onClick={handleCloseModal}>{t('Cancel')}</Button>
          <Button primary onClick={handleCropSave}><Icon name="save" />{t('Save')}</Button>
        </Modal.Actions>
      </Modal>
    </Segment>
  );
}

export default function Profile () {
  const { t } = useTranslation('Profile')
  const { country, setCountry } = useIndexContext()

  const [ firstName, setFirstName ] = useState('')
  const [ lastName, setLastName ] = useState('')
  const [ email, setEmail ] = useState('')
  const [ phone, setPhone ] = useState('')
  const [ line1, setLine1 ] = useState('')
  const [ line2, setLine2 ] = useState('')
  const [ city, setCity ] = useState('')
  const [ state, setState ] = useState('')
  const [ postalCode, setPostalCode ] = useState('')

  const [ firstNameError, setFirstNameError ] = useState('')
  const [ lastNameError, setLastNameError ] = useState('')
  const [ emailError, setEmailError ] = useState('')
  const [ phoneError, setPhoneError ] = useState('')
  const [ line1Error, setLine1Error ] = useState('')
  const [ line2Error, setLine2Error ] = useState('')
  const [ cityError, setCityError ] = useState('')
  const [ stateError, setStateError ] = useState('')
  const [ postalCodeError, setPostalCodeError ] = useState('')
  const [ countryError, setCountryError ] = useState('')

  const [ responseError, setResponseError ] = useState('')
  const [ loading, setLoading ] = useState(false)

  const getProfile = async () => {
    setLoading(true)
    try {
      const res = await axios.get(`${conf.api.url}/profile`, {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true,
        crossOrigin: { mode: 'cors' },
      })
      console.log('res:', res)
      setFirstName(res?.data?.firstName || '<User>')
      setLastName(res?.data?.lastName || '')
      setEmail(res?.data?.email || '')
      setPhone(res?.data?.phone || '')
      setLine1(res?.data?.address?.line1 || '')
      setLine2(res?.data?.address?.line2 || '')
      setCity(res?.data?.address?.city || '')
      setState(res?.data?.address?.state || '')
      setPostalCode(res?.data?.address?.postalCode || '')
      setCountry(res?.data?.address?.country || '')
    } catch (err) {
      console.error('get profile error:', err);
      return setResponseError(err?.response?.data?.message || t('Error getting user profile.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    getProfile()
  }, [])

  const postProfile = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await axios.post(`${conf.api.url}/profile`, {
        email,
        firstName,
        lastName,
        phone,
        address: {
          line1,
          line2,
          city,
          state,
          postalCode,
          country,
        },
      }, {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true,
      })
      console.log('res:', res)
    } catch (err) {
      console.error('post profile error:', err);
      return setResponseError(err?.response?.data?.message || t('Error posting user profile.'))
    } finally {
      setLoading(false)
    }
  }

  return (<>
    <Container fluid>
      <Menubar />
    </Container>

    <Container style={{ marginTop: '1rem' }}>

      <Loader active={loading} inline='centered' />
      { responseError &&
        <Message
          negative
          style={{ textAlign: 'left'}}
          icon='exclamation circle'
          header={t('Error')}
          content={responseError}
          onDismiss={() => setResponseError('')}
        />
      }

      <Segment secondary>
        <Header as='h3'>
          {t('Profile')}
        </Header>

        <AvatarUploader/>

        <Form onSubmit={postProfile}>
          <Segment stacked>
            <Form.Group widths='equal'>

              <Form.Input
                fluid
                icon='user'
                iconPosition='left'
                placeholder={t('First Name')}
                name='firstName'
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                error={ !isEmpty(firstNameError) && {
                  content: firstNameError,
                  pointing: 'above',
                }}
                required
              />
              <Form.Input
                fluid
                icon='user outline'
                iconPosition='left'
                placeholder={t('Last Name')}
                name='lastName'
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                error={ !isEmpty(lastNameError) && {
                  content: lastNameError,
                  pointing: 'above',
                }}
                required
              />
            </Form.Group>

            <Form.Group widths='equal'>
              <Form.Input
                fluid
                icon='at'
                iconPosition='left'
                placeholder={t('E-mail address')}
                name='email'
                value={email}
                onChange={e => setEmail(e.target.value)}
                error={ !isEmpty(emailError) && {
                  content: emailError,
                  pointing: 'above',
                }}
                required
                readOnly
              />
              <Form.Input
                fluid
                icon='phone'
                iconPosition='left'
                placeholder={t('Phone (optionally)')}
                name='phone'
                value={phone}
                onChange={e => setPhone(e.target.value)}
                error={ !isEmpty(phoneError) && {
                  content: phoneError,
                  pointing: 'above',
                }}
              />
            </Form.Group>

            <Divider />

            <p>{t('Address')}:</p>

            <Form.Input
              fluid
              icon='home'
              iconPosition='left'
              placeholder={t('line1')}
              name='line1'
              value={line1}
              onChange={e => setLine1(e.target.value)}
              error={ !isEmpty(line1Error) && {
                content: line1Error,
                pointing: 'above',
              }}
            />

            <Form.Input
              fluid
              icon='building outline'
              iconPosition='left'
              placeholder={t('line2')}
              name='line2'
              value={line2}
              onChange={e => setLine2(e.target.value)}
              error={ !isEmpty(line2Error) && {
                content: line2Error,
                pointing: 'above',
              }}
            />

            <Form.Group widths='equal'>
              <Form.Input
                fluid
                icon='map marker alternate'
                iconPosition='left'
                placeholder={t('city')}
                name='city'
                value={city}
                onChange={e => setCity(e.target.value)}
                error={ !isEmpty(cityError) && {
                  content: cityError,
                  pointing: 'above',
                }}
              />
              <Form.Input
                fluid
                icon='flag'
                iconPosition='left'
                placeholder={t('state')}
                name='state'
                value={state}
                onChange={e => setState(e.target.value)}
                error={ !isEmpty(stateError) && {
                  content: stateError,
                  pointing: 'above',
                }}
              />
            </Form.Group>

            <Form.Group widths='equal'>
              <Form.Input
                fluid
                icon='envelope'
                iconPosition='left'
                placeholder={t('postalCode')}
                name='postalCode'
                value={postalCode}
                onChange={e => setPostalCode(e.target.value)}
                error={ !isEmpty(postalCodeError) && {
                  content: postalCodeError,
                  pointing: 'above',
                }}
              />
              {/*
              <Form.Input
                fluid
                icon='globe'
                iconPosition='left'
                placeholder={t('country')}
                name='country'
                value={country}
                onChange={e => setCountry(e.target.value)}
                error={ !isEmpty(countryError) && {
                  content: countryError,
                  pointing: 'above',
                }}
              />
              */}
              <CountryFormField fluid countryError={countryError} />

            </Form.Group>

            <Divider />

            <Button.Group>
              <Button
                icon labelPosition='left' type='submit'
                onClick={getProfile}
              >
                <Icon name='cancel' />
                {t('Cancel')}
              </Button>
              <Button.Or/>
              <Button
                icon labelPosition='right' type='submit'
                color={conf.style.color0}
              >
                <Icon name='save' />
                {t('Save')}
              </Button>
            </Button.Group>
          </Segment>
        </Form>

      </Segment>
    </Container>
  </>)
}
