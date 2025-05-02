const jwt = require('jsonwebtoken');
const User = require('./userModel');
const axios = require('axios');
// Token creation utility
const createToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  });
};


//  Register Controller
exports.register = async (req, res) => {
  try {
    const { fullName, puId, codeforcesHandle, email, password } = req.body;

    // Check for duplicate user using static method
    const userExists = await User.isUserExists({ puId, email, codeforcesHandle });
    if (userExists) {
      return res.status(400).json({ error: 'User already exists with this PU ID, email, or Codeforces handle.' });
    }

    // Create user
    const user = await User.create({ fullName, puId, codeforcesHandle, email, password });

    // Create token
    const token = createToken(user._id);
    res.cookie('token', token, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000
    });

    res.status(201).send({fullName, email: user.email });
  } catch (err) {
    res.status(400).send({ error: err.message });
  }
};

//  Login Controller
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = createToken(user._id);
    res.cookie('token', token, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000
    });

    res.status(201).send({ isVerified :user.isVerified, fullName: user.fullName, email: user.email });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
};

// Logout Controller
exports.logout = (req, res) => {
  res.clearCookie('token');
  res.send({ message: 'Logged out successfully' });
};

exports.getAllUsersCodeforcesStats = async (req, res) => {
  try {
    // Step 1: Get up to 10 users
    const users = await User.find().limit(10);
    const handles = users.map(user => user.codeforcesHandle);

    if (!handles.length) {
      return res.status(404).json({ error: "No users found" });
    }

    // Step 2: Fetch user info in bulk
    const infoRes = await axios.get(`https://codeforces.com/api/user.info?handles=${handles.join(';')}`);
    const userInfoList = infoRes.data.result;

    const stats = [];

    // Step 3: Loop through each user for submissions and contests
    for (const userInfo of userInfoList) {
      const [submissionRes, contestRes] = await Promise.all([
        axios.get(`https://codeforces.com/api/user.status?handle=${userInfo.handle}`),
        axios.get(`https://codeforces.com/api/user.rating?handle=${userInfo.handle}`)
      ]);

      const submissions = submissionRes.data.result;
      const contests = contestRes.data.result;

      const solvedSet = new Set();
      submissions.forEach(sub => {
        if (sub.verdict === "OK") {
          solvedSet.add(`${sub.problem.contestId}-${sub.problem.index}`);
        }
      });

      const lastContest = contests.length > 0 ? contests[contests.length - 1] : null;

      stats.push({
        handle: userInfo.handle,
        rank: userInfo.rank,
        rating: userInfo.rating,
        maxRating: userInfo.maxRating,
        totalSolved: solvedSet.size,
        contestsParticipated: contests.length,
        lastContest: lastContest
          ? {
              contestName: lastContest.contestName,
              rank: lastContest.rank,
              newRating: lastContest.newRating,
              oldRating: lastContest.oldRating
            }
          : null
      });
    }

    res.status(200).json(stats);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Failed to fetch Codeforces stats" });
  }
};


exports.getCodeforcesSingleStats = async (req, res) => {
  try {
    const { handle } = req.params;

    // Step 1: Find the user in DB
    const user = await User.findOne({ codeforcesHandle: handle });
    if (!user) {
      return res.status(404).json({ error: "User not found in database" });
    }

    // Step 2: Fetch Codeforces user info
    const infoRes = await axios.get(`https://codeforces.com/api/user.info?handles=${handle}`);
    const userInfo = infoRes.data.result[0];

    // Step 3: Fetch Codeforces submission history
    const submissionRes = await axios.get(`https://codeforces.com/api/user.status?handle=${handle}`);
    const submissions = submissionRes.data.result;

    const solvedSet = new Set();
    submissions.forEach((sub) => {
      if (sub.verdict === "OK") {
        solvedSet.add(sub.problem.contestId + "-" + sub.problem.index);
      }
    });

    // Step 4: Fetch Codeforces contest history
    const contestRes = await axios.get(`https://codeforces.com/api/user.rating?handle=${handle}`);
    const contests = contestRes.data.result;
    const lastContest = contests.length > 0 ? contests[contests.length - 1] : null;

    // Step 5: Respond with compiled stats
    const stats = {
      handle: userInfo.handle,
      rank: userInfo.rank,
      rating: userInfo.rating,
      maxRating: userInfo.maxRating,
      contestsParticipated: contests.length,
      lastContest: lastContest
        ? {
            contestName: lastContest.contestName,
            rank: lastContest.rank,
            oldRating: lastContest.oldRating,
            newRating: lastContest.newRating,
          }
        : null,
      totalSolved: solvedSet.size,
    };

    res.status(200).json(stats);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Failed to fetch Codeforces data" });
  }
};


exports.getUserByEmail = async (req, res) => {
  try {
    const { email } = req.params;

    // Find user by email
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Optional: exclude password from response
    const { password, ...userData } = user.toObject();

    res.status(200).send(userData);
  } catch (err) {
    res.status(500).send({ error: 'Server error' });
  }
};


exports.getTopCodeforcesSolvers = async (req, res) => {
  try {
    const nowUTC = new Date(); // current UTC time
    const now = new Date(nowUTC.getTime() + 6 * 60 * 60 * 1000); // BD time (UTC+6)

    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0); // today at 00:00 in BD time

    // Step 1: Fetch users and get handles
    const users = await User.find();
    const handles = users.map(user => user.codeforcesHandle).filter(Boolean); // filter nulls

    if (!handles.length) {
      return res.status(404).json({ error: "No Codeforces handles found" });
    }

    // Step 2: Fetch user info
    const infoRes = await axios.get(`https://codeforces.com/api/user.info?handles=${handles.join(';')}`);
    const userInfoList = infoRes.data.result;

    const stats = [];

    // Step 3: Loop through users
    for (const userInfo of userInfoList) {
      const handle = userInfo.handle;
      const submissionRes = await axios.get(`https://codeforces.com/api/user.status?handle=${handle}`);
      const submissions = submissionRes.data.result;

      // Step 4: Filter for today’s AC submissions (converted to BD time)
      const solvedToday = submissions.filter(sub => {
        const timeUTC = new Date(sub.creationTimeSeconds * 1000);
        const timeBD = new Date(timeUTC.getTime() + 6 * 60 * 60 * 1000); // Convert to BD time
        return (
          timeBD >= startOfDay &&
          timeBD <= now &&
          sub.verdict === 'OK'
        );
      });

      // Count unique problems solved
      const uniqueProblems = new Set(
        solvedToday.map(sub => `${sub.problem.contestId}-${sub.problem.index}`)
      );

      if (uniqueProblems.size > 0) {
        stats.push({
          handle,
          totalSolvedToday: uniqueProblems.size,
        });
      }
    }

    // Step 5: Sort descending by total solved
    stats.sort((a, b) => b.totalSolvedToday - a.totalSolvedToday);

    return res.status(200).json(stats);
  } catch (err) {
    console.error(err.message);
    return res.status(500).json({ error: "Failed to fetch Codeforces stats" });
  }
};


exports.approveUser = async (req, res) => {
  try {
    const { email } = req.params;

    const user = await User.findOneAndUpdate(
      { email },
      { isVerified: true },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json({ message: 'User approved successfully', user });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// Get all users (excluding password and optionally deleted accounts)
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({ isDeleteD: false })
      .select('-_id fullName codeforcesHandle email isVerified isAdmin');

    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};


exports.deleteUserAccount = async (req, res) => {
  try {
    const { email } = req.params;

    const user = await User.findOneAndUpdate(
      { email },
      { isDeleteD: true },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json({ message: 'User account deleted (soft delete)', user });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};


// Update user by email (partial update: e.g., isAdmin, isDeleteD)
exports.updateUserByEmail = async (req, res) => {
  try {
    const { email } = req.params;
    const updates = req.body;

    // Allow only specific fields to be updated
    const allowedFields = ['isAdmin', 'isDeleteD', 'isVerified'];
    const filteredUpdates = {};

    for (const key of allowedFields) {
      if (updates.hasOwnProperty(key)) {
        filteredUpdates[key] = updates[key];
      }
    }

    if (Object.keys(filteredUpdates).length === 0) {
      return res.status(400).json({ error: 'No valid fields provided for update' });
    }

    const updatedUser = await User.findOneAndUpdate(
      { email },
      { $set: filteredUpdates },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json({ message: 'User updated successfully' });
  } catch (err) {
    console.error('Update Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getCodeforcesData = async (req, res) => {
  const email = req.params.email; // Get the email from the request parameter

  if (!email) {
    return res.status(400).json({ message: 'Email is required.' });
  }

  try {
    // Fetch user by email from the database
    const user = await User.findOne({ email });
    if (!user || !user.codeforcesHandle) {
      return res.status(404).json({ message: 'User not found or Codeforces handle missing.' });
    }
    const handle = user.codeforcesHandle;

    // Fetch Codeforces User Info
    const cfInfo = await axios.get(
      `https://codeforces.com/api/user.info?handles=${handle}`
    );

    if (!cfInfo.data.result || cfInfo.data.result.length === 0) {
      return res.status(404).json({ message: 'Codeforces user not found.' });
    }

    const userInfo = cfInfo.data.result[0];

    // Fetch Codeforces User Status (Submission data)
    const cfStatus = await axios.get(
      `https://codeforces.com/api/user.status?handle=${handle}`
    );

    const submissions = cfStatus.data.result;
    const solved = submissions.filter((sub) => sub.verdict === 'OK');

    // Process solved problems and dates
    const solvedDates = new Set();
    const solvedStats = {};
    const recentProblems = [];

    solved.forEach((sub) => {
      const date = new Date(sub.creationTimeSeconds * 1000).toLocaleDateString();
      solvedStats[date] = (solvedStats[date] || 0) + 1;
      solvedDates.add(new Date(sub.creationTimeSeconds * 1000).toDateString());

      const problemKey = `${sub.problem.contestId}-${sub.problem.index}`;
      if (!recentProblems.some((p) => p.key === problemKey)) {
        recentProblems.push({
          key: problemKey,
          name: sub.problem.name,
          link: `https://codeforces.com/contest/${sub.problem.contestId}/problem/${sub.problem.index}`,
        });
      }
    });

    return res.status(200).json({
      cfData: userInfo,
      solvedStats,
      solvedDates: Array.from(solvedDates),
      recentProblems: recentProblems.slice(0, 5),
    });
  } catch (err) {
    console.error('Error fetching data from Codeforces', err);
    return res.status(500).json({ message: 'Failed to fetch Codeforces data.' });
  }
};

