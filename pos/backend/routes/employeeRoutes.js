const express = require('express');
const router = express.Router();
const {
  getAllEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  verifyPin,
  searchEmployees,
  updatePin,
  sendTemporaryPin
} = require('../controllers/employeeController');

router.route('/')
  .get(getAllEmployees)
  .post(createEmployee);

router.get('/search/:query', searchEmployees);

router.post('/verify-pin', verifyPin);

router.route('/:id')
  .get(getEmployeeById)
  .put(updateEmployee)
  .delete(deleteEmployee);

router.put('/:id/pin', updatePin);

router.post('/:id/send-temporary-pin', sendTemporaryPin);

module.exports = router;

