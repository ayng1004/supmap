// src/components/map/QRCodeShare.jsx
import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { FaTimes, FaShare, FaDownload, FaMobileAlt, FaExternalLinkAlt, FaStore } from 'react-icons/fa';
import './QRCodeShare.css';

/**
 * Composant pour afficher et partager un QR code d'itinéraire
 * @param {Object} routeData - Données de l'itinéraire à partager
 * @param {Function} onClose - Fonction à appeler pour fermer le panneau
 */
const QRCodeShare = ({ routeData, onClose }) => {
  const [qrValue, setQrValue] = useState('');
  const [routeInfo, setRouteInfo] = useState(null);
  const [appOpened, setAppOpened] = useState(false);
  const [timeoutId, setTimeoutId] = useState(null);
  
  // Définir les URLs des stores pour les fallbacks
  const ANDROID_STORE_URL = "https://play.google.com/store/apps/details?id=com.ayng.frontendmobile";
  const IOS_STORE_URL = "https://apps.apple.com/app/id???????"; // Remplacer par votre ID App Store
  
  useEffect(() => {
    if (routeData) {
      // Créer une chaîne encodée avec les informations d'itinéraire
      const routeInfoData = {
        type: 'route',
        start: routeData.startPoint.placeName,
        end: routeData.endPoint.placeName,
        startCoords: routeData.startPoint.coordinates,
        endCoords: routeData.endPoint.coordinates,
        options: routeData.options
      };

      // Stocker les données d'itinéraire pour les utiliser dans d'autres fonctions
      setRouteInfo(routeInfoData);

      // Créer une URL pour le QR code avec le schéma personnalisé de l'application mobile
      // Ajout d'un timestamp pour éviter les problèmes de cache
      const timestamp = new Date().getTime();
      const qrCodeValue = `4proj://route?data=${encodeURIComponent(JSON.stringify(routeInfoData))}&t=${timestamp}`;
      setQrValue(qrCodeValue);
      
      console.log('QR code généré:', qrCodeValue);
    }
    
    // Nettoyer le timeout si le composant est démonté
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [routeData]);

  /**
   * Télécharger le QR code au format SVG
   */
  const handleDownload = () => {
    const svg = document.getElementById('route-qrcode');
    
    if (svg) {
      // Convertir le SVG en chaîne
      const svgData = new XMLSerializer().serializeToString(svg);
      
      // Créer un blob avec les données SVG
      const blob = new Blob([svgData], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      
      // Créer un lien pour télécharger
      const link = document.createElement('a');
      link.href = url;
      link.download = 'itineraire-4proj.svg';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Libérer l'URL
      URL.revokeObjectURL(url);
    }
  };

  /**
   * Partager l'itinéraire via l'API Web Share si disponible
   */
  const handleShare = async () => {
    if (!navigator.share) {
      alert("Le partage n'est pas supporté par votre navigateur");
      return;
    }

    try {
      await navigator.share({
        title: 'Itinéraire partagé via 4PROJ',
        text: `Itinéraire de ${routeData.startPoint.placeName} à ${routeData.endPoint.placeName}`,
        url: window.location.href // Vous pourriez vouloir adapter ceci à votre cas d'usage
      });
    } catch (error) {
      console.error('Erreur lors du partage:', error);
      // Ne pas afficher d'alerte si l'utilisateur a annulé le partage
      if (error.name !== 'AbortError') {
        alert("Une erreur est survenue lors du partage");
      }
    }
  };

  /**
   * Détection du système d'exploitation
   */
  const detectOS = () => {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    
    // Détection iOS
    if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
      return 'ios';
    }
    
    // Détection Android
    if (/android/i.test(userAgent)) {
      return 'android';
    }
    
    // Par défaut, considérer comme desktop
    return 'other';
  };

  /**
   * Tenter d'ouvrir l'application directement avec mécanisme de fallback amélioré
   */
  const handleOpenApp = () => {
    if (!routeInfo) return;
    
    // Réinitialiser l'état
    setAppOpened(false);
    if (timeoutId) clearTimeout(timeoutId);
    
    // Créer l'URL de deep link
    const timestamp = new Date().getTime();
    const deepLink = `4proj://route?data=${encodeURIComponent(JSON.stringify(routeInfo))}&t=${timestamp}`;
    
    // Détecter le système d'exploitation
    const os = detectOS();
    
    // Méthode 1: window.location (méthode standard)
    const tryOpenApp = () => {
      // Méthode pour détecter si l'app a été ouverte
      const onAppOpened = () => {
        setAppOpened(true);
        clearTimeout(id);
      };
      
      // Ajouter un écouteur pour détecter si la page perd le focus (app ouverte)
      window.addEventListener('blur', onAppOpened);
      
      // Définir un timeout pour vérifier si l'app n'a pas été ouverte
      const id = setTimeout(() => {
        // Si l'app n'a pas été ouverte après le délai, retirer l'écouteur
        window.removeEventListener('blur', onAppOpened);
        
        if (!appOpened) {
          // Si l'app n'a pas été ouverte, rediriger vers le store approprié
if (window.confirm("L'application 4PROJ n'est pas installée ou n'a pas pu être ouverte. Souhaitez-vous l'installer?")) {
            if (os === 'android') {
              window.location.href = ANDROID_STORE_URL;
            } else if (os === 'ios') {
              window.location.href = IOS_STORE_URL;
            } else {
              alert("Pour utiliser cette fonctionnalité, veuillez installer l'application 4PROJ sur votre appareil mobile.");
            }
          }
        }
      }, 2500);
      
      setTimeoutId(id);
      
      // Tentative d'ouverture de l'app
      window.location.href = deepLink;
    };
    
    // Méthode 2: iframe (alternative pour certains navigateurs)
    const tryOpenAppWithIframe = () => {
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = deepLink;
      document.body.appendChild(iframe);
      
      setTimeout(() => {
        document.body.removeChild(iframe);
        if (!appOpened) {
          tryOpenApp(); // Fallback sur la méthode 1 si l'iframe ne fonctionne pas
        }
      }, 500);
    };
    
    // Utiliser la méthode appropriée selon l'OS
    if (os === 'ios') {
      tryOpenAppWithIframe();
    } else {
      tryOpenApp();
    }
  };

  /**
   * Générer une URL pour les appareils qui n'ont pas l'application installée
   * Cette URL peut rediriger vers le store ou une page web
   */
  const generateFallbackURL = () => {
    if (!routeInfo) return '';
    
    // Base URL pour la page web qui redirige vers l'app ou le store
    const webRedirectUrl = "https://4proj.app/redirect";
    
    // Créer l'URL avec les paramètres de l'itinéraire
    return `${webRedirectUrl}?data=${encodeURIComponent(JSON.stringify(routeInfo))}`;
  };

  /**
   * Ouvre une page web de redirection (solution alternative)
   */
  const handleOpenWebRedirect = () => {
    const redirectUrl = generateFallbackURL();
    if (redirectUrl) {
      window.open(redirectUrl, '_blank');
    }
  };

  return (
    <div className="qrcode-panel">
      <div className="qrcode-header">
        <h3>Partager cet itinéraire</h3>
        <button className="close-btn" onClick={onClose}>
          <FaTimes />
        </button>
      </div>
      
      <div className="qrcode-content">
        <p>Scannez ce QR code avec l'application 4PROJ pour ouvrir l'itinéraire</p>
        
        <div className="qrcode-wrapper">
          <QRCodeSVG
            id="route-qrcode"
            value={qrValue}
            size={250}
            level="H"
            includeMargin={true}
            imageSettings={{
              src: `${process.env.PUBLIC_URL}/logo.png`,
              height: 50,
              width: 50,
              excavate: true,
            }}
          />
        </div>
        
        <p className="route-details">
          <strong>De:</strong> {routeData?.startPoint?.placeName}<br />
          <strong>À:</strong> {routeData?.endPoint?.placeName}<br />
          <strong>Mode:</strong> {
            routeData?.options?.travelMode === 'driving' ? 'Voiture' :
            routeData?.options?.travelMode === 'cycling' ? 'Vélo' : 'À pied'
          }
        </p>
        
        <div className="qrcode-actions">
          <button className="action-btn share-btn" onClick={handleShare}>
            <FaShare /> Partager
          </button>
          <button className="action-btn download-btn" onClick={handleDownload}>
            <FaDownload /> Télécharger
          </button>
        </div>
        
        {/* Bouton d'ouverture directe */}
        <button 
          className="action-btn open-app-btn" 
          onClick={handleOpenApp}
        >
          <FaMobileAlt /> Ouvrir dans l'application
        </button>
        
        {/* Bouton pour installer l'application */}
        <div className="store-buttons">
          <a 
            className="action-btn store-btn" 
            href={ANDROID_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            <FaStore /> Android
          </a>
          <a 
            className="action-btn store-btn" 
            href={IOS_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            <FaStore /> iOS
          </a>
        </div>
        
        <div className="qrcode-help">
          <p className="help-text">
            <strong>Astuce:</strong> Si le scan ne fonctionne pas, utilisez le bouton "Ouvrir dans l'application" ci-dessus 
            ou installez l'application via les liens des boutiques.
          </p>
        </div>
      </div>
    </div>
  );
};

export default QRCodeShare;