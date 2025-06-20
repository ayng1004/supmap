import React, { useState, useEffect } from 'react';
import { FaSun, FaMoon } from 'react-icons/fa'; // Icônes de soleil et lune
import './ThemeToggle.css';

const ThemeToggle = () => {
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Vérifie si le mode sombre est activé dans localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      setIsDarkMode(true);
      document.body.classList.add('dark-mode');
    }
  }, []);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    if (!isDarkMode) {
      document.body.classList.add('dark-mode');
      localStorage.setItem('theme', 'dark'); // Enregistrer le thème sombre
    } else {
      document.body.classList.remove('dark-mode');
      localStorage.setItem('theme', 'light'); // Enregistrer le thème clair
    }
  };

  return (
    <label className="switch">
      <input type="checkbox" checked={isDarkMode} onChange={toggleTheme} />
      <span className="slider">
        <FaMoon className="moon-icon" /> {/* Icône lune */}
        <FaSun className="sun-icon" /> {/* Icône soleil */}
      </span>
    </label>
  );
};

export default ThemeToggle;
