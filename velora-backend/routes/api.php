<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\CartController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\AdminController;

Route::post('register', [AuthController::class, 'register']);
Route::post('login', [AuthController::class, 'login']);

Route::post('logout', [AuthController::class, 'logout']);

Route::get('categories', [CategoryController::class, 'index']);
Route::get('products', [ProductController::class, 'index']);
Route::get('products/{product}', [ProductController::class, 'show']);

Route::post('cart', [CartController::class, 'store']);
Route::get('cart', [CartController::class, 'index']);
Route::patch('cart/{item}', [CartController::class, 'update']);
Route::delete('cart/{item}', [CartController::class, 'destroy']);

Route::post('orders', [OrderController::class, 'store']);

Route::post('admin/products', [ProductController::class, 'store']);
Route::put('admin/products/{product}', [ProductController::class, 'update']);
Route::delete('admin/products/{product}', [ProductController::class, 'destroy']);

Route::get('admin/dashboard', [AdminController::class, 'dashboard']);
Route::get('admin/orders', [AdminController::class, 'orders']);

