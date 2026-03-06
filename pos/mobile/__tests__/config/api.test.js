/**
 * Property-based tests for API configuration
 * **Feature: mobile-local-database-connection, Property 1: API URL Construction**
 * **Validates: Requirements 1.1**
 */

import { createApiConfig } from '../../config/api';

// Simple property test implementation (without fast-check for now)
describe('API Configuration', () => {
  /**
   * Property 1: API URL Construction
   * For any API configuration with a valid IP address and port,
   * the constructed API_URL should be the BASE_URL concatenated with "/api"
   */
  describe('Property 1: API URL Construction', () => {
    // Test with various valid IP addresses
    const testCases = [
      { ip: '192.168.1.1', port: 5000 },
      { ip: '192.168.0.100', port: 5000 },
      { ip: '10.0.0.1', port: 3000 },
      { ip: '172.16.0.1', port: 8080 },
      { ip: '127.0.0.1', port: 5000 },
      { ip: '192.168.1.6', port: 5000 },
    ];

    testCases.forEach(({ ip, port }) => {
      it(`should construct correct URLs for IP ${ip} and port ${port}`, () => {
        const config = createApiConfig(ip, port);
        const expectedBaseUrl = `http://${ip}:${port}`;
        const expectedApiUrl = `${expectedBaseUrl}/api`;

        expect(config.BASE_URL).toBe(expectedBaseUrl);
        expect(config.API_URL).toBe(expectedApiUrl);
      });
    });

    it('should use default port 5000 when not specified', () => {
      const config = createApiConfig('192.168.1.1');
      expect(config.BASE_URL).toBe('http://192.168.1.1:5000');
      expect(config.API_URL).toBe('http://192.168.1.1:5000/api');
    });

    it('should always have API_URL equal to BASE_URL + /api', () => {
      // Property: For any config, API_URL === BASE_URL + '/api'
      const randomIps = ['192.168.1.1', '10.0.0.5', '172.16.0.10'];
      const randomPorts = [3000, 5000, 8080];

      randomIps.forEach(ip => {
        randomPorts.forEach(port => {
          const config = createApiConfig(ip, port);
          expect(config.API_URL).toBe(`${config.BASE_URL}/api`);
        });
      });
    });
  });
});
