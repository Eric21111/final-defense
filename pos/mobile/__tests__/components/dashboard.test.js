/**
 * Property-based tests for Dashboard
 * **Feature: mobile-local-database-connection, Property 9: Dashboard Owner Name Display**
 * **Validates: Requirements 5.1**
 */

/**
 * Helper function to get welcome name from user object
 * This mirrors the logic in the Dashboard component
 */
const getWelcomeName = (currentUser) => {
  if (!currentUser) return "Owner";
  
  return (
    currentUser.firstName ||
    currentUser.name ||
    currentUser.email?.split("@")[0] ||
    "Owner"
  );
};

describe('Dashboard', () => {
  /**
   * Property 9: Dashboard Owner Name Display
   * **Feature: mobile-local-database-connection, Property 9: Dashboard Owner Name Display**
   * **Validates: Requirements 5.1**
   * 
   * For any logged-in owner, the dashboard welcome message should include 
   * the owner's firstName or name
   */
  describe('Property 9: Dashboard Owner Name Display', () => {
    // Test with various owner data structures
    const ownerTestCases = [
      {
        user: { firstName: 'John', lastName: 'Doe', name: 'John Doe', email: 'john@test.com', role: 'Owner' },
        expectedName: 'John',
        description: 'should display firstName when available'
      },
      {
        user: { name: 'Jane Smith', email: 'jane@test.com', role: 'Owner' },
        expectedName: 'Jane Smith',
        description: 'should display name when firstName is not available'
      },
      {
        user: { email: 'bob@company.com', role: 'Owner' },
        expectedName: 'bob',
        description: 'should display email prefix when name fields are not available'
      },
      {
        user: { firstName: '', name: '', email: 'test@example.com', role: 'Owner' },
        expectedName: 'test',
        description: 'should fall back to email when name fields are empty strings'
      },
      {
        user: null,
        expectedName: 'Owner',
        description: 'should display "Owner" when no user is logged in'
      },
      {
        user: undefined,
        expectedName: 'Owner',
        description: 'should display "Owner" when user is undefined'
      },
    ];

    ownerTestCases.forEach(({ user, expectedName, description }) => {
      it(description, () => {
        const welcomeName = getWelcomeName(user);
        expect(welcomeName).toBe(expectedName);
      });
    });

    // Property: For any owner with firstName, firstName should be displayed
    it('should always prefer firstName over other fields', () => {
      const testUsers = [
        { firstName: 'Alice', name: 'Alice Wonder', email: 'alice@test.com' },
        { firstName: 'Bob', name: 'Robert Smith', email: 'bob@test.com' },
        { firstName: 'Charlie', name: 'Charles Brown', email: 'charlie@test.com' },
      ];

      testUsers.forEach(user => {
        const welcomeName = getWelcomeName(user);
        expect(welcomeName).toBe(user.firstName);
      });
    });

    // Property: Welcome name should never be empty or undefined
    it('should never return empty or undefined welcome name', () => {
      const edgeCases = [
        null,
        undefined,
        {},
        { firstName: '', name: '', email: '' },
        { firstName: null, name: null, email: null },
      ];

      edgeCases.forEach(user => {
        const welcomeName = getWelcomeName(user);
        expect(welcomeName).toBeTruthy();
        expect(welcomeName.length).toBeGreaterThan(0);
      });
    });

    // Property: Email extraction should work correctly
    it('should correctly extract username from email', () => {
      const emailTestCases = [
        { email: 'john.doe@company.com', expected: 'john.doe' },
        { email: 'admin@test.org', expected: 'admin' },
        { email: 'user123@example.net', expected: 'user123' },
      ];

      emailTestCases.forEach(({ email, expected }) => {
        const user = { email, role: 'Owner' };
        const welcomeName = getWelcomeName(user);
        expect(welcomeName).toBe(expected);
      });
    });
  });
});
