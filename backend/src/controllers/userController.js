import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { config } from "../common/config/config.js";
import { v4 as uuidv4 } from "uuid";
import { mailTemplate } from "../common/email/mailTemplate.js";
import { sendMailer } from "../common/email/mailConfig.js";
import { User } from "../database/models/User.js";
import { Verification } from "../database/models/Verification.js";

export const postJoin = async (req, res) => {
  const {
    country,
    email,
    password,
    confirmation_password,
    name,
    lastName,
    firstName,
    birthNumber,
    recommendCode,
    verified,
  } = req.body;
  console.log(req.body);
  try {
    if (password !== confirmation_password) {
      return res.status(400).json({ status: "diffPassword", message: `비밀번호가 일치 하지 않습니다` });
    }
    const exists = await User.findOne({
      where: { email },
    });
    console.log(exists);

    if (exists) {
      return res.status(409).json({ status: "notExistEmail", message: `해당 이메일이 존재 합니다` });
    }

    // 신분증 인증,,계좌 1원 인증, 이메일 인증

    // 1.이메일 인증
    const codeNum = uuidv4();
    const mailVar = {
      form: `${process.env.GOOGLE_MAIL}`,
      to: email,
      subject: `${name}님 환영합니다!`,
      html: mailTemplate(email, codeNum),
    };

    const user = await User.create({
      email,
      password,
      name,
      country,
      verified,
      firstName,
      lastName,
      recommendCode,
      birthNumber,
    });
    console.log(user);
    await Verification.create({
      code: codeNum,
      user_id: user.id,
    });

    await sendMailer(mailVar);

    return res.status(201).json({ user });
  } catch (error) {
    return res.status(400).json({ status: "extraServerError", message: `잠시후에 다시 시도해주세요` });
  }
};

export const postLogin = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(400).json({ status: "notExistEmail" });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ status: "wrongPassword" });
    }

    if (!user.verified) {
      return res.status(401).json({ status: "notVerified" });
    }

    const token = jwt.sign({ id: user.id }, config.jwt.secretKey, {
      expiresIn: config.jwt.expiresInSec,
    });
    return res.status(200).json({ token, email, verified: user.verified });
  } catch (error) {
    return res.status(400).json({ status: "extraServerError" });
  }
};

export const postCheck = async (req, res) => {
  const { email, codeNum } = req.body;
  console.log(req.body);
  try {
    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.status(400).json({ status: "notExistUser" });
    }

    const verification = await Verification.findOne({
      where: { user_id: user.id },
    });
    console.log(verification);

    if (!verification) {
      return res.status(400).json({ status: "notVerified" });
    }
    console.log(codeNum);
    console.log(verification.code);

    if (codeNum === verification.code) {
      user.verified = true;
      await user.save();
    }
    return res.status(200).json({ message: "가입이 완료 되었습니다" });
  } catch (error) {
    return res.status(400).json({ status: "extraServerError" });
  }
};

export const postEmailCheck = async (req, res) => {
  const { email } = req.body;
  try {
    if (!email.includes(".com")) {
      return res.json({ status: "notEmail", message: "이메일 형식이 아닙니다" });
    }

    const user = await User.findOne({ where: { email } });
    if (user) {
      return res.status(409).json({ status: "existEmail", message: `해당 이메일이 존재 합니다` });
    }
    return res.status(200).json({ message: "가입 가능한 이메일입니다" });
  } catch (error) {
    return res.status(400).json({ status: "extraServerError", message: `잠시후에 다시 시도해주세요` });
  }
};
