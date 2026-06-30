const { getAdminAndManagerUsers } = require('../services/authentik.service');

exports.listUsers = async (req, res, next) => {
  try {
    const users = await getAdminAndManagerUsers();
    res.json({ success: true, data: users });
  } catch (err) {
    next(err);
  }
};
