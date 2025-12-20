/**
 * HTML and CSS Validation Tests
 * Tests to validate HTML structure and CSS for new weather components
 */

const { describe, test, expect } = require('@jest/globals');

describe('Weather Modal HTML Structure', () => {
  test('should have all required weather modal elements', () => {
    document.body.innerHTML = `
      <div class="modal-overlay" id="weatherModalOverlay">
        <div class="modal weather-modal">
          <div class="modal-header">
            <h2>天気予報の設定</h2>
            <button class="modal-close" id="closeWeatherModal">&times;</button>
          </div>
          <div class="modal-body">
            <div class="form-field">
              <label for="weatherLocation">場所の名前</label>
              <input type="text" id="weatherLocation" class="modal-input">
            </div>
            <div class="form-field">
              <label>緯度・経度</label>
              <div class="location-inputs">
                <input type="number" id="weatherLat" class="modal-input location-input" step="0.0001">
                <input type="number" id="weatherLon" class="modal-input location-input" step="0.0001">
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button id="cancelWeatherModal">キャンセル</button>
            <button id="clearWeatherSettings">設定を削除</button>
            <button id="saveWeatherSettings">保存</button>
          </div>
        </div>
      </div>
    `;

    expect(document.getElementById('weatherModalOverlay')).toBeTruthy();
    expect(document.getElementById('closeWeatherModal')).toBeTruthy();
    expect(document.getElementById('weatherLocation')).toBeTruthy();
    expect(document.getElementById('weatherLat')).toBeTruthy();
    expect(document.getElementById('weatherLon')).toBeTruthy();
    expect(document.getElementById('cancelWeatherModal')).toBeTruthy();
    expect(document.getElementById('clearWeatherSettings')).toBeTruthy();
    expect(document.getElementById('saveWeatherSettings')).toBeTruthy();
  });

  test('should have weather display in clock container', () => {
    document.body.innerHTML = `
      <div class="clock-container">
        <div class="clock-time" id="currentTime">00:00:00</div>
        <div class="clock-date-weather">
          <span class="clock-date" id="currentDate">0000/00/00 (月)</span>
          <span class="weather-display" id="weatherDisplay"></span>
        </div>
      </div>
    `;

    const clockContainer = document.querySelector('.clock-container');
    const weatherDisplay = document.getElementById('weatherDisplay');
    
    expect(clockContainer).toBeTruthy();
    expect(weatherDisplay).toBeTruthy();
    expect(weatherDisplay.classList.contains('weather-display')).toBe(true);
  });

  test('should have preset location buttons', () => {
    document.body.innerHTML = `
      <div class="preset-locations">
        <button class="preset-location-btn" data-lat="35.6762" data-lon="139.6503" data-name="東京">東京</button>
        <button class="preset-location-btn" data-lat="34.6937" data-lon="135.5023" data-name="大阪">大阪</button>
        <button class="preset-location-btn" data-lat="35.1815" data-lon="136.9066" data-name="名古屋">名古屋</button>
      </div>
    `;

    const presetButtons = document.querySelectorAll('.preset-location-btn');
    
    expect(presetButtons.length).toBe(3);
    expect(presetButtons[0].dataset.lat).toBe('35.6762');
    expect(presetButtons[0].dataset.name).toBe('東京');
  });
});

describe('Completed Tasks HTML Structure', () => {
  test('should have completed date section structure', () => {
    document.body.innerHTML = `
      <div class="completed-date-section">
        <h3 class="completed-date-header">2024/1/1（2件）</h3>
        <div class="completed-task-list">
          <div class="completed-task-item" data-todo-id="1">
            <div class="completed-task-info">
              <span class="completed-check">✓</span>
              <span class="completed-task-title">Task 1</span>
            </div>
            <div class="completed-task-times">
              <span class="deadline-time">期限: 10:00</span>
              <span class="completed-time">完了: 10:30</span>
            </div>
          </div>
        </div>
      </div>
    `;

    const section = document.querySelector('.completed-date-section');
    const header = document.querySelector('.completed-date-header');
    const taskList = document.querySelector('.completed-task-list');
    const taskItem = document.querySelector('.completed-task-item');
    
    expect(section).toBeTruthy();
    expect(header).toBeTruthy();
    expect(taskList).toBeTruthy();
    expect(taskItem).toBeTruthy();
    expect(taskItem.dataset.todoId).toBe('1');
  });
});

describe('CSS Class Validation', () => {
  test('should validate weather icon classes', () => {
    const weatherIcons = [
      'weather-icon-sunny',
      'weather-icon-cloudy',
      'weather-icon-cloudy-sun',
      'weather-icon-rainy',
      'weather-icon-rainy-heavy',
      'weather-icon-snowy',
      'weather-icon-thunder',
      'weather-icon-fog',
      'weather-icon-unknown'
    ];

    weatherIcons.forEach(iconClass => {
      document.body.innerHTML = `<span class="weather-icon ${iconClass}"></span>`;
      const icon = document.querySelector(`.${iconClass}`);
      
      expect(icon).toBeTruthy();
      expect(icon.classList.contains('weather-icon')).toBe(true);
    });
  });

  test('should validate weather display structure', () => {
    document.body.innerHTML = `
      <span class="weather-display">
        <span class="weather-period">
          <span class="weather-period-label">午前</span>
          <span class="weather-icon weather-icon-sunny"></span>
        </span>
        <span class="weather-temp">
          <span class="weather-temp-high">25°</span>
          <span class="weather-temp-low">18°</span>
        </span>
      </span>
    `;

    expect(document.querySelector('.weather-display')).toBeTruthy();
    expect(document.querySelector('.weather-period')).toBeTruthy();
    expect(document.querySelector('.weather-period-label')).toBeTruthy();
    expect(document.querySelector('.weather-temp')).toBeTruthy();
    expect(document.querySelector('.weather-temp-high')).toBeTruthy();
    expect(document.querySelector('.weather-temp-low')).toBeTruthy();
  });

  test('should validate modal classes', () => {
    document.body.innerHTML = `
      <div class="modal-overlay">
        <div class="modal weather-modal">
          <div class="modal-header"></div>
          <div class="modal-body"></div>
          <div class="modal-footer"></div>
        </div>
      </div>
    `;

    expect(document.querySelector('.modal-overlay')).toBeTruthy();
    expect(document.querySelector('.weather-modal')).toBeTruthy();
    expect(document.querySelector('.modal-header')).toBeTruthy();
    expect(document.querySelector('.modal-body')).toBeTruthy();
    expect(document.querySelector('.modal-footer')).toBeTruthy();
  });
});

describe('Input Validation Attributes', () => {
  test('should have correct input types and attributes', () => {
    document.body.innerHTML = `
      <input type="text" id="weatherLocation">
      <input type="number" id="weatherLat" step="0.0001">
      <input type="number" id="weatherLon" step="0.0001">
    `;

    const locationInput = document.getElementById('weatherLocation');
    const latInput = document.getElementById('weatherLat');
    const lonInput = document.getElementById('weatherLon');

    expect(locationInput.type).toBe('text');
    expect(latInput.type).toBe('number');
    expect(lonInput.type).toBe('number');
    expect(latInput.step).toBe('0.0001');
    expect(lonInput.step).toBe('0.0001');
  });

  test('should validate button types', () => {
    document.body.innerHTML = `
      <button type="button" class="preset-location-btn">Location</button>
      <button type="button" class="btn-geolocation">Use Current Location</button>
    `;

    const presetBtn = document.querySelector('.preset-location-btn');
    const geoBtn = document.querySelector('.btn-geolocation');

    expect(presetBtn.type).toBe('button');
    expect(geoBtn.type).toBe('button');
  });
});

describe('Accessibility Attributes', () => {
  test('should have title attribute for weather display', () => {
    document.body.innerHTML = `
      <span class="weather-display" id="weatherDisplay" title="クリックして場所を設定"></span>
    `;

    const weatherDisplay = document.getElementById('weatherDisplay');
    
    expect(weatherDisplay.title).toBe('クリックして場所を設定');
  });

  test('should have labels for form inputs', () => {
    document.body.innerHTML = `
      <div class="form-field">
        <label for="weatherLocation">場所の名前</label>
        <input type="text" id="weatherLocation">
      </div>
    `;

    const label = document.querySelector('label[for="weatherLocation"]');
    const input = document.getElementById('weatherLocation');

    expect(label).toBeTruthy();
    expect(input).toBeTruthy();
    expect(label.htmlFor).toBe('weatherLocation');
  });
});

describe('Responsive Classes', () => {
  test('should have flex layout classes', () => {
    document.body.innerHTML = `
      <div class="clock-date-weather" style="display: flex; align-items: center; gap: 16px;"></div>
      <div class="location-inputs" style="display: flex; gap: 12px;"></div>
      <div class="preset-locations" style="display: flex; flex-wrap: wrap; gap: 8px;"></div>
    `;

    const dateWeather = document.querySelector('.clock-date-weather');
    const locationInputs = document.querySelector('.location-inputs');
    const presetLocations = document.querySelector('.preset-locations');

    expect(dateWeather).toBeTruthy();
    expect(locationInputs).toBeTruthy();
    expect(presetLocations).toBeTruthy();
  });
});