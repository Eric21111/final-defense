const express = require('express');
const router = express.Router();
const {
  getAllEmployees,
  getEmployeeById,
  getEmployeeImage,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  verifyPin,
  searchEmployees,
  updatePin,
  sendTemporaryPin,
  logoutEmployee,
  getOnlineEmployees,
  employeeHeartbeat
} = require('../controllers/employeeController');

router.route('/')
  .get(getAllEmployees)
  .post(createEmployee);

router.get('/search/:query', searchEmployees);

router.post('/verify-pin', verifyPin);

router.post('/logout', logoutEmployee);

router.post('/heartbeat', employeeHeartbeat);

router.get('/online', getOnlineEmployees);

router.route('/:id')
  .get(getEmployeeById)
  .put(updateEmployee)
  .delete(deleteEmployee);

router.get('/:id/image', getEmployeeImage);

router.put('/:id/pin', updatePin);

router.post('/:id/send-temporary-pin', sendTemporaryPin);

module.exports = router;


