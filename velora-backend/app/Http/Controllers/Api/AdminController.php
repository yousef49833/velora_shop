<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use Illuminate\Http\Request;

class AdminController extends Controller
{
    public function dashboard(Request $request)
    {
        $this->assertAdmin($request);
        return response()->json([
            'users' => User::count(),
            'products' => Product::count(),
            'orders' => Order::count(),
            'revenue' => Order::sum('total'),
        ]);
    }

    public function orders(Request $request)
    {
        $this->assertAdmin($request);
        return response()->json(Order::with('user', 'items.product')->orderBy('created_at', 'desc')->get());
    }

    private function assertAdmin(Request $request)
    {
        $user = $this->authUser($request);
        if (! $user->isAdmin()) {
            abort(403, 'Admin access required');
        }

        return $user;
    }
}
