# Velora E-Commerce Debugging Guide

## Problem Summary
The application was showing generic "couldn't add" errors when trying to add items to cart, wishlist, or create orders.

## Root Cause Identified
Multiple issues were causing the failures:

**1. Generic Error Messages**
- Error handling was catching all errors and showing "Could not add product to cart" without details
- No HTTP status codes displayed to help debugging

**2. Token Loss in Login Response (CRITICAL BUG)**
- The `apiClient.ts` was extracting only `payload.user` from login responses, discarding the `token`
- This caused all subsequent authenticated requests to fail with "Invalid token (401)"
- **Fixed**: Modified `apiClient.ts` to return full payload when both `user` and `token` are present

**3. JWT Secret Mismatch**
- `.env` file had a different JWT secret than the backend default
- This caused token validation to fail even after login
- **Fixed**: Updated `.env` to use `JWT_SECRET=velora-local-dev-secret`

## Fixes Applied

### 1. Enhanced API Client Error Handling
**File**: `src/services/apiClient.ts`
- Added connection error handling with descriptive messages
- Enhanced logging to show request method, URL, body, and response status
- Errors now include HTTP status codes for easier debugging
- Connection failures show clear message: "Cannot connect to server at http://localhost:3100/api"

### 2. Improved Error Messages
Updated error handling in multiple components to show the actual error message and HTTP status code instead of generic messages:

- `src/components/ProductCard.tsx`
- `src/pages/ProductDetailsPage.tsx`
- `src/pages/CartPage.tsx`

Now errors will show like:
- "Add to cart failed: Product not found (404)"
- "Wishlist failed: Cannot connect to server at http://localhost:3100/api (0)"
- "Checkout failed: Invalid token (401)"

---

## How to Debug Network Issues

### Step 1: Open Browser Developer Tools
Press `F12` or right-click → "Inspect" → Go to "Network" tab

### Step 2: Perform an Action
Click "Add to Cart" or any button that triggers an API request

### Step 3: Analyze the Request

#### Look for:
1. **Status Code** (in the "Status" column):
   - `200` - Success ✓
   - `201` - Created successfully ✓
   - `401` - Unauthorized (token missing/invalid)
   - `404` - Not Found (wrong endpoint URL)
   - `500` - Server Error (backend code issue)
   - `(failed)` or `(pending)` - Connection refused (wrong port/CORS)

2. **Request Headers**:
   - Check if `Authorization: Bearer <token>` is present
   - Check if `Content-Type: application/json` is set

3. **Request Payload**:
   - Click on the request → "Payload" tab
   - Verify the data being sent is correct

4. **Response**:
   - Click on the request → "Response" tab
   - See the actual error message from the server

### Step 4: Common Issues & Solutions

#### Issue 1: Connection Refused (Status: failed)
**Symptom**: Request shows as "(failed)" with no response
**Cause**: Backend server not running or wrong port
**Solution**: 
- Make sure backend is running: `npm run dev` (runs both frontend and backend)
- Verify port in `src/services/apiClient.ts` matches the PORT in `.env` file (default: 3100)
- Check `.env` file for `PORT=3100` configuration

#### Issue 2: 401 Unauthorized
**Symptom**: Status 401, error message "Invalid token" or "Authorization token missing"
**Cause**: User not logged in, token expired, or old invalid token in storage
**Solution**:
- **Log out and log back in** to get a fresh token
- Clear localStorage if needed (Application tab → Local Storage → Clear)
- Use default test accounts:
  - Admin: `admin@velora.com` / `velora443471@`
  - Vendor: `vendor@velora.com` / `velora443471@`
  - Or register a new account

#### Issue 3: 404 Not Found
**Symptom**: Status 404, error message "API endpoint not found"
**Cause**: Wrong API endpoint URL
**Solution**:
- Check if the route exists in `src/routes/`
- Verify the path in `src/services/storefrontApi.ts` matches backend routes

#### Issue 4: 500 Internal Server Error
**Symptom**: Status 500, generic error message
**Cause**: Backend code error
**Solution**:
- Check backend console for error logs
- Look at `src/middlewares/errorHandler.ts` for error details
- Verify data being sent matches expected format

#### Issue 5: CORS Error
**Symptom**: Console shows "CORS policy blocked" or "No 'Access-Control-Allow-Origin' header"
**Cause**: Backend CORS configuration doesn't allow frontend origin
**Solution**:
- Check CORS config in `src/app.ts`
- Ensure frontend port (usually 5173) is in the allowed origins list
- For development: `origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175']`

---

## Testing the Fix

### 1. Start the Development Servers
```bash
npm run dev
```
This starts both frontend and backend together.
Should see:
- `Local:   http://localhost:5173/` (frontend)
- `[Velora] HTTP server running on http://localhost:3100` (backend)

Or start them separately:
- Frontend only: `npm run dev:frontend`
- Backend only: `npm run dev:backend`

### 3. Test the Features
1. **Login** with a test account
2. **Browse products** on the homepage
3. **Click "Add to Cart"** on any product
   - Should see success toast: "Added to cart"
   - Check Network tab: Status should be `201`
4. **Add to Wishlist**
   - Should see success toast: "Added to wishlist"
5. **Go to Cart** and try **Checkout**
   - Should see success toast: "Order created successfully"

### 4. Verify Error Messages
If something fails, you should now see specific error messages like:
- "Add to cart failed: Product not found (404)"
- "Wishlist failed: Cannot connect to server (0)"
- "Checkout failed: Invalid token (401)"

---

## Backend API Endpoints Reference

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (requires token)

### Products
- `GET /api/products` - Get all products
- `GET /api/products/:id` - Get single product
- `POST /api/products` - Create product (vendor/admin)

### Cart
- `GET /api/cart` - Get user's cart
- `POST /api/cart` - Add item to cart
- `PATCH /api/cart/:id` - Update cart item quantity
- `DELETE /api/cart/:id` - Remove item from cart

### Wishlist
- `GET /api/wishlist` - Get user's wishlist
- `POST /api/wishlist` - Add item to wishlist
- `DELETE /api/wishlist/:productId` - Remove item from wishlist

### Orders
- `POST /api/orders` - Create order (checkout)
- `GET /api/orders/me` - Get user's orders
- `PATCH /api/orders/:id/status` - Update order status (admin)

---

## Quick Checklist for "Add to Cart" Issues

- [ ] Backend server running on port 3100?
- [ ] Frontend API_BASE set to `http://localhost:3100/api`?
- [ ] User is logged in (token exists in localStorage)?
- [ ] Product exists in the system?
- [ ] Product is in stock?
- [ ] Network tab shows successful 201 response?
- [ ] No CORS errors in console?
- [ ] Error message shows specific details (not generic)?

---

## Additional Resources

### Console Logs
The application now logs detailed information:
- API requests with method, URL, and body
- API responses with status code
- Errors with full stack traces

Check browser console (F12 → Console) for these logs.

### Backend Logs
The backend logs all requests and errors:
- Request method and URL
- Authentication status
- Error details

Check the terminal where backend is running.

### Database (Store)
Data is stored in `data/store.json`:
- Users
- Products
- Cart items
- Wishlist items
- Orders

You can inspect this file to verify data persistence.

---

## Contact & Support

If you're still experiencing issues after following this guide:

1. **Check the logs** - Both browser console and backend terminal
2. **Verify configuration** - Ports, URLs, and environment variables
3. **Test with Postman/curl** - Bypass frontend to test API directly
4. **Review recent changes** - What changed before the issue started?

Remember: The error message is your friend! The improved error handling will now show you exactly what's wrong.