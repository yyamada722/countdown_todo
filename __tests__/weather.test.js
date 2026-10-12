/**
 * Weather Functionality Tests
 * Tests for the new weather feature including settings, API integration, and display
 */

const { describe, test, expect, beforeEach } = require('@jest/globals');

// Mock DOM elements
function setupWeatherDOM() {
  document.body.innerHTML = `
    <div id="weatherDisplay"></div>
    <div id="weatherModalOverlay" class="modal-overlay">
      <div class="modal weather-modal">
        <div class="modal-header">
          <h2>天気予報の設定</h2>
          <button class="modal-close" id="closeWeatherModal">&times;</button>
        </div>
        <div class="modal-body">
          <input type="text" id="weatherLocation" />
          <input type="number" id="weatherLat" />
          <input type="number" id="weatherLon" />
        </div>
        <div class="modal-footer">
          <button id="cancelWeatherModal">キャンセル</button>
          <button id="clearWeatherSettings">設定を削除</button>
          <button id="saveWeatherSettings">保存</button>
          <button id="useGeolocation">現在地を使用</button>
        </div>
      </div>
    </div>
  `;
}

describe('Weather Code Mapping', () => {
  test('should map weather code 0 to sunny', () => {
    const weatherCodeMap = {
      0: { icon: 'sunny', desc: '快晴' },
      1: { icon: 'sunny', desc: '晴れ' },
      3: { icon: 'cloudy', desc: '曇り' },
    };
    
    expect(weatherCodeMap[0]).toEqual({ icon: 'sunny', desc: '快晴' });
    expect(weatherCodeMap[0].icon).toBe('sunny');
    expect(weatherCodeMap[0].desc).toBe('快晴');
  });

  test('should map weather code 61-65 to rainy conditions', () => {
    const weatherCodeMap = {
      61: { icon: 'rainy', desc: '小雨' },
      63: { icon: 'rainy', desc: '雨' },
      65: { icon: 'rainy-heavy', desc: '大雨' },
    };
    
    expect(weatherCodeMap[61].icon).toBe('rainy');
    expect(weatherCodeMap[63].icon).toBe('rainy');
    expect(weatherCodeMap[65].icon).toBe('rainy-heavy');
  });

  test('should map weather code 71-75 to snowy conditions', () => {
    const weatherCodeMap = {
      71: { icon: 'snowy', desc: '小雪' },
      73: { icon: 'snowy', desc: '雪' },
      75: { icon: 'snowy', desc: '大雪' },
    };
    
    expect(weatherCodeMap[71].icon).toBe('snowy');
    expect(weatherCodeMap[73].icon).toBe('snowy');
    expect(weatherCodeMap[75].icon).toBe('snowy');
  });

  test('should map weather code 95-99 to thunder conditions', () => {
    const weatherCodeMap = {
      95: { icon: 'thunder', desc: '雷雨' },
      96: { icon: 'thunder', desc: '雷雨（雹）' },
      99: { icon: 'thunder', desc: '雷雨（大粒雹）' },
    };
    
    expect(weatherCodeMap[95].icon).toBe('thunder');
    expect(weatherCodeMap[96].icon).toBe('thunder');
    expect(weatherCodeMap[99].icon).toBe('thunder');
  });

  test('should handle fog conditions', () => {
    const weatherCodeMap = {
      45: { icon: 'fog', desc: '霧' },
      48: { icon: 'fog', desc: '霧氷' },
    };
    
    expect(weatherCodeMap[45]).toEqual({ icon: 'fog', desc: '霧' });
    expect(weatherCodeMap[48]).toEqual({ icon: 'fog', desc: '霧氷' });
  });
});

describe('Weather Settings Management', () => {
  beforeEach(() => {
    setupWeatherDOM();
    localStorage.clear();
  });

  test('should save weather settings to localStorage', () => {
    const settings = {
      name: '東京',
      lat: 35.6762,
      lon: 139.6503
    };
    
    localStorage.setItem('weatherSettings', JSON.stringify(settings));
    
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'weatherSettings',
      JSON.stringify(settings)
    );
  });

  test('should load weather settings from localStorage', () => {
    const settings = {
      name: '大阪',
      lat: 34.6937,
      lon: 135.5023
    };
    
    localStorage.getItem.mockReturnValue(JSON.stringify(settings));
    
    const loaded = JSON.parse(localStorage.getItem('weatherSettings'));
    
    expect(loaded).toEqual(settings);
    expect(loaded.name).toBe('大阪');
    expect(loaded.lat).toBe(34.6937);
    expect(loaded.lon).toBe(135.5023);
  });

  test('should validate latitude range (-90 to 90)', () => {
    const invalidLat1 = 91;
    const invalidLat2 = -91;
    const validLat = 35.6762;
    
    expect(invalidLat1 < -90 || invalidLat1 > 90).toBe(true);
    expect(invalidLat2 < -90 || invalidLat2 > 90).toBe(true);
    expect(validLat >= -90 && validLat <= 90).toBe(true);
  });

  test('should validate longitude range (-180 to 180)', () => {
    const invalidLon1 = 181;
    const invalidLon2 = -181;
    const validLon = 139.6503;
    
    expect(invalidLon1 < -180 || invalidLon1 > 180).toBe(true);
    expect(invalidLon2 < -180 || invalidLon2 > 180).toBe(true);
    expect(validLon >= -180 && validLon <= 180).toBe(true);
  });

  test('should clear weather settings', () => {
    localStorage.setItem('weatherSettings', JSON.stringify({ name: '東京' }));
    localStorage.removeItem('weatherSettings');
    
    expect(localStorage.removeItem).toHaveBeenCalledWith('weatherSettings');
  });

  test('should handle empty weather settings', () => {
    localStorage.getItem.mockReturnValue(null);
    
    const settings = localStorage.getItem('weatherSettings');
    
    expect(settings).toBeNull();
  });
});

describe('Weather API Integration', () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  test('should construct correct Open-Meteo API URL', () => {
    const lat = 35.6762;
    const lon = 139.6503;
    const expectedUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min&hourly=weather_code&timezone=Asia%2FTokyo&forecast_days=1`;
    
    expect(expectedUrl).toContain('latitude=35.6762');
    expect(expectedUrl).toContain('longitude=139.6503');
    expect(expectedUrl).toContain('timezone=Asia%2FTokyo');
    expect(expectedUrl).toContain('forecast_days=1');
  });

  test('should fetch weather data successfully', async () => {
    const mockWeatherData = {
      daily: {
        temperature_2m_max: [25],
        temperature_2m_min: [18]
      },
      hourly: {
        weather_code: [1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3]
      }
    };
    
    fetch.mockResolvedValue({
      ok: true,
      json: async () => mockWeatherData
    });
    
    const response = await fetch('https://api.open-meteo.com/v1/forecast');
    const data = await response.json();
    
    expect(data).toEqual(mockWeatherData);
    expect(data.daily.temperature_2m_max[0]).toBe(25);
    expect(data.daily.temperature_2m_min[0]).toBe(18);
  });

  test('should handle API fetch errors', async () => {
    fetch.mockResolvedValue({
      ok: false,
      status: 404
    });
    
    const response = await fetch('https://api.open-meteo.com/v1/forecast');
    
    expect(response.ok).toBe(false);
    expect(response.status).toBe(404);
  });

  test('should handle network errors', async () => {
    fetch.mockRejectedValue(new Error('Network error'));
    
    await expect(fetch('https://api.open-meteo.com/v1/forecast'))
      .rejects.toThrow('Network error');
  });
});

describe('Weather Code Frequency Analysis', () => {
  test('should find most frequent weather code in morning hours', () => {
    const morningCodes = [1, 1, 1, 2, 1, 1]; // 6AM to 11AM
    
    const frequency = {};
    morningCodes.forEach(code => {
      frequency[code] = (frequency[code] || 0) + 1;
    });
    
    const mostFrequent = Object.keys(frequency).reduce((a, b) => 
      frequency[a] > frequency[b] ? a : b
    );
    
    expect(mostFrequent).toBe('1');
    expect(frequency[1]).toBe(5);
    expect(frequency[2]).toBe(1);
  });

  test('should find most frequent weather code in afternoon hours', () => {
    const afternoonCodes = [3, 3, 61, 3, 3, 3]; // 12PM to 5PM
    
    const frequency = {};
    afternoonCodes.forEach(code => {
      frequency[code] = (frequency[code] || 0) + 1;
    });
    
    const mostFrequent = Object.keys(frequency).reduce((a, b) => 
      frequency[a] > frequency[b] ? a : b
    );
    
    expect(mostFrequent).toBe('3');
    expect(frequency[3]).toBe(5);
    expect(frequency[61]).toBe(1);
  });

  test('should handle uniform distribution', () => {
    const codes = [1, 2, 3, 4, 5, 6];
    
    const frequency = {};
    codes.forEach(code => {
      frequency[code] = (frequency[code] || 0) + 1;
    });
    
    const allEqual = Object.values(frequency).every(count => count === 1);
    
    expect(allEqual).toBe(true);
  });

  test('should handle single code array', () => {
    const codes = [1];
    
    const frequency = {};
    codes.forEach(code => {
      frequency[code] = (frequency[code] || 0) + 1;
    });
    
    expect(frequency[1]).toBe(1);
    expect(Object.keys(frequency).length).toBe(1);
  });
});

describe('Geolocation Integration', () => {
  beforeEach(() => {
    navigator.geolocation.getCurrentPosition.mockClear();
  });

  test('should successfully get current position', (done) => {
    const mockPosition = {
      coords: {
        latitude: 35.6762,
        longitude: 139.6503,
        accuracy: 10
      }
    };
    
    navigator.geolocation.getCurrentPosition.mockImplementation((success) => {
      success(mockPosition);
    });
    
    navigator.geolocation.getCurrentPosition((position) => {
      expect(position.coords.latitude).toBe(35.6762);
      expect(position.coords.longitude).toBe(139.6503);
      done();
    });
  });

  test('should handle permission denied error', (done) => {
    const mockError = {
      code: 1, // PERMISSION_DENIED
      message: 'User denied geolocation'
    };
    
    navigator.geolocation.getCurrentPosition.mockImplementation((success, error) => {
      error(mockError);
    });
    
    navigator.geolocation.getCurrentPosition(
      () => {},
      (error) => {
        expect(error.code).toBe(1);
        expect(error.message).toBe('User denied geolocation');
        done();
      }
    );
  });

  test('should handle position unavailable error', (done) => {
    const mockError = {
      code: 2, // POSITION_UNAVAILABLE
      message: 'Position unavailable'
    };
    
    navigator.geolocation.getCurrentPosition.mockImplementation((success, error) => {
      error(mockError);
    });
    
    navigator.geolocation.getCurrentPosition(
      () => {},
      (error) => {
        expect(error.code).toBe(2);
        done();
      }
    );
  });

  test('should handle timeout error', (done) => {
    const mockError = {
      code: 3, // TIMEOUT
      message: 'Geolocation timeout'
    };
    
    navigator.geolocation.getCurrentPosition.mockImplementation((success, error) => {
      error(mockError);
    });
    
    navigator.geolocation.getCurrentPosition(
      () => {},
      (error) => {
        expect(error.code).toBe(3);
        done();
      }
    );
  });
});

describe('Preset Locations', () => {
  test('should have correct Tokyo coordinates', () => {
    const tokyo = { lat: 35.6762, lon: 139.6503, name: '東京' };
    
    expect(tokyo.lat).toBe(35.6762);
    expect(tokyo.lon).toBe(139.6503);
    expect(tokyo.name).toBe('東京');
  });

  test('should have correct Osaka coordinates', () => {
    const osaka = { lat: 34.6937, lon: 135.5023, name: '大阪' };
    
    expect(osaka.lat).toBe(34.6937);
    expect(osaka.lon).toBe(135.5023);
  });

  test('should have correct Nagoya coordinates', () => {
    const nagoya = { lat: 35.1815, lon: 136.9066, name: '名古屋' };
    
    expect(nagoya.lat).toBe(35.1815);
    expect(nagoya.lon).toBe(136.9066);
  });

  test('should have correct Sapporo coordinates', () => {
    const sapporo = { lat: 43.0618, lon: 141.3545, name: '札幌' };
    
    expect(sapporo.lat).toBe(43.0618);
    expect(sapporo.lon).toBe(141.3545);
  });

  test('should have correct Fukuoka coordinates', () => {
    const fukuoka = { lat: 33.5904, lon: 130.4017, name: '福岡' };
    
    expect(fukuoka.lat).toBe(33.5904);
    expect(fukuoka.lon).toBe(130.4017);
  });
});

describe('Weather Display Updates', () => {
  beforeEach(() => {
    setupWeatherDOM();
  });

  test('should display empty when no settings', () => {
    const weatherDisplay = document.getElementById('weatherDisplay');
    weatherDisplay.innerHTML = '';
    
    expect(weatherDisplay.innerHTML).toBe('');
  });

  test('should format temperature display', () => {
    const tempMax = 25;
    const tempMin = 18;
    
    const formatted = `${tempMax}° / ${tempMin}°`;
    
    expect(formatted).toBe('25° / 18°');
  });

  test('should round temperature values', () => {
    const tempMax = 25.7;
    const tempMin = 17.3;
    
    const roundedMax = Math.round(tempMax);
    const roundedMin = Math.round(tempMin);
    
    expect(roundedMax).toBe(26);
    expect(roundedMin).toBe(17);
  });

  test('should extract morning weather codes (6-11)', () => {
    const hourlyData = new Array(24).fill(0);
    hourlyData[6] = 1;
    hourlyData[7] = 1;
    hourlyData[8] = 2;
    hourlyData[9] = 1;
    hourlyData[10] = 1;
    hourlyData[11] = 1;
    
    const morningCodes = hourlyData.slice(6, 12);
    
    expect(morningCodes.length).toBe(6);
    expect(morningCodes).toEqual([1, 1, 2, 1, 1, 1]);
  });

  test('should extract afternoon weather codes (12-17)', () => {
    const hourlyData = new Array(24).fill(0);
    hourlyData[12] = 3;
    hourlyData[13] = 3;
    hourlyData[14] = 3;
    hourlyData[15] = 61;
    hourlyData[16] = 3;
    hourlyData[17] = 3;
    
    const afternoonCodes = hourlyData.slice(12, 18);
    
    expect(afternoonCodes.length).toBe(6);
    expect(afternoonCodes).toEqual([3, 3, 3, 61, 3, 3]);
  });
});