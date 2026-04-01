import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { mutateStore, readStore, sanitizeUser, takeNextId, type StoreUser } from '../data/store';

function createToken(user: Pick<StoreUser, 'id' | 'email' | 'name' | 'role'>) {
  return jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role }, config.jwtSecret, {
    expiresIn: '7d',
  });
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function getAvatar(name: string) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=10b981&color=000000`;
}

// Initialize default accounts
async function initializeDefaultAccounts() {
  const data = readStore();
  
  // Check if admin already exists
  const existingAdmin = data.users.find((item) => item.email === 'admin@velora.com');
  if (!existingAdmin) {
    const adminPassword = 'velora443471@';
    const adminHashed = await bcrypt.hash(adminPassword, 10);
    
    mutateStore((storeData) => {
      const adminUser = {
        id: takeNextId(storeData, 'nextUserId'),
        name: 'Admin User',
        email: 'admin@velora.com',
        passwordHash: adminHashed,
        role: 'admin' as const,
        provider: 'local' as const,
        isVerified: true,
        otpCode: null,
        otpExpiresAt: null,
        avatar: getAvatar('Admin User'),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      storeData.users.push(adminUser);
      return adminUser;
    });
    console.log('✅ Default admin account created: admin@velora.com / velora443471@');
  }
  
  // Check if vendor already exists
  const existingVendor = data.users.find((item) => item.email === 'vendor@velora.com');
  if (!existingVendor) {
    const vendorPassword = 'velora443471@';
    const vendorHashed = await bcrypt.hash(vendorPassword, 10);
    
    mutateStore((storeData) => {
      const vendorUser = {
        id: takeNextId(storeData, 'nextUserId'),
        name: 'Vendor User',
        email: 'vendor@velora.com',
        passwordHash: vendorHashed,
        role: 'vendor' as const,
        provider: 'local' as const,
        isVerified: true,
        otpCode: null,
        otpExpiresAt: null,
        avatar: getAvatar('Vendor User'),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      storeData.users.push(vendorUser);
      return vendorUser;
    });
    console.log('✅ Default vendor account created: vendor@velora.com / velora443471@');
  }
}

// Initialize on module load
initializeDefaultAccounts().catch(console.error);

export async function registerUser(name: string, email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const hashed = await bcrypt.hash(password, 10);

  const user = mutateStore((data) => {
    const existing = data.users.find((item) => item.email.toLowerCase() === normalizedEmail);
    if (existing) {
      throw new Error('Email already in use');
    }

    const now = new Date().toISOString();
    const createdUser = {
      id: takeNextId(data, 'nextUserId'),
      name: name.trim(),
      email: normalizedEmail,
      passwordHash: hashed,
      role: 'customer' as const,
      provider: 'local' as const,
      isVerified: true,
      otpCode: null,
      otpExpiresAt: null,
      avatar: getAvatar(name.trim()),
      createdAt: now,
      updatedAt: now,
    };

    data.users.push(createdUser);
    return createdUser;
  });

  const token = createToken(user);
  return { user: sanitizeUser(user), token };
}

// OTP functions - stubbed for compatibility
export async function verifyOtp(email: string, otp: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const data = readStore();
  const user = data.users.find((item) => item.email.toLowerCase() === normalizedEmail);
  if (!user) {
    throw new Error('User not found');
  }

  if (!user.otpCode || user.otpCode !== otp) {
    throw new Error('Invalid OTP');
  }

  if (user.otpExpiresAt && new Date() > new Date(user.otpExpiresAt)) {
    throw new Error('OTP expired');
  }

  const updatedUser = mutateStore((storeData) => {
    const foundUser = storeData.users.find((item) => item.id === user.id);
    if (foundUser) {
      foundUser.isVerified = true;
      foundUser.otpCode = null;
      foundUser.otpExpiresAt = null;
      foundUser.updatedAt = new Date().toISOString();
    }
    return foundUser!;
  });

  const token = createToken(updatedUser);
  return { user: sanitizeUser(updatedUser), token };
}

export async function resendOtp(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  const user = mutateStore((data) => {
    const existing = data.users.find((item) => item.email.toLowerCase() === normalizedEmail);
    if (!existing) {
      throw new Error('User not found');
    }

    existing.otpCode = otp;
    existing.otpExpiresAt = expiresAt.toISOString();
    existing.updatedAt = new Date().toISOString();
    return existing;
  });

  return { devOtp: otp };
}

export async function loginUser(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const data = readStore();
  const user = data.users.find((item) => item.email.toLowerCase() === normalizedEmail);
  if (!user) {
    throw new Error('Invalid credentials');
  }

  if (!user.isVerified) {
    throw new Error('Account is not verified. Please verify the OTP sent to your email.');
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    throw new Error('Invalid credentials');
  }

  const token = createToken(user);
  return { user: sanitizeUser(user), token };
}

export async function socialLogin(provider: 'google' | 'apple') {
  const demoEmail = provider === 'google' ? 'google.customer@velora.local' : 'apple.customer@velora.local';
  const demoName = provider === 'google' ? 'Google Customer' : 'Apple Customer';

  const user = mutateStore((data) => {
    const existing = data.users.find((item) => item.email === demoEmail);
    if (existing) {
      existing.updatedAt = new Date().toISOString();
      existing.isVerified = true;
      existing.provider = provider;
      return existing;
    }

    const now = new Date().toISOString();
    const createdUser = {
      id: takeNextId(data, 'nextUserId'),
      name: demoName,
      email: demoEmail,
      passwordHash: bcrypt.hashSync(`${provider}-oauth-demo`, 10),
      role: 'customer' as const,
      provider,
      isVerified: true,
      otpCode: null,
      otpExpiresAt: null,
      avatar: getAvatar(demoName),
      createdAt: now,
      updatedAt: now,
    };

    data.users.push(createdUser);
    return createdUser;
  });

  const token = createToken(user);
  return {
    user: sanitizeUser(user),
    token,
    message: `${provider} sign-in completed in local demo mode`,
  };
}

export async function updateUserProfile(
  userId: number,
  payload: { name?: string; email?: string; password?: string }
) {
  const normalizedEmail = payload.email?.trim().toLowerCase();
  const nextPasswordHash = payload.password?.trim() ? await bcrypt.hash(payload.password.trim(), 10) : null;

  const user = mutateStore((data) => {
    const existing = data.users.find((item) => item.id === userId);
    if (!existing) {
      throw new Error('User not found');
    }

    if (normalizedEmail && normalizedEmail !== existing.email) {
      const emailInUse = data.users.find((item) => item.email.toLowerCase() === normalizedEmail && item.id !== userId);
      if (emailInUse) {
        throw new Error('Email already in use');
      }
      existing.email = normalizedEmail;
    }

    if (payload.name?.trim()) {
      existing.name = payload.name.trim();
      existing.avatar = getAvatar(existing.name);
    }

    if (nextPasswordHash) {
      existing.passwordHash = nextPasswordHash;
    }

    existing.updatedAt = new Date().toISOString();
    return existing;
  });

  return sanitizeUser(user);
}

export async function getUserById(id: number) {
  const data = readStore();
  const user = data.users.find((item) => item.id === id);
  if (!user) return null;

  return sanitizeUser(user);
}
