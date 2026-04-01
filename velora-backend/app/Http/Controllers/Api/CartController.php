<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CartItem;
use Illuminate\Http\Request;

class CartController extends Controller
{
    public function index(Request $request)
    {
        $user = $this->authUser($request);
        return response()->json($user->cartItems()->with('product')->get());
    }

    public function store(Request $request)
    {
        $user = $this->authUser($request);

        $data = $request->validate([
            'product_id' => 'required|exists:products,id',
            'quantity' => 'nullable|integer|min:1',
        ]);

        $item = CartItem::updateOrCreate(
            ['user_id' => $user->id, 'product_id' => $data['product_id']],
            ['quantity' => $data['quantity'] ?? 1]
        );

        return response()->json($item, 201);
    }

    public function update(Request $request, CartItem $item)
    {
        $this->authorizeOwnership($request, $item);

        $data = $request->validate(['quantity' => 'required|integer|min:1']);
        $item->update($data);

        return response()->json($item);
    }

    public function destroy(Request $request, CartItem $item)
    {
        $this->authorizeOwnership($request, $item);
        $item->delete();

        return response()->json(['message' => 'Removed from cart']);
    }

    private function authorizeOwnership(Request $request, CartItem $item)
    {
        $user = $this->authUser($request);
        if ($item->user_id !== $user->id) {
            abort(403, 'Forbidden');
        }
    }
}
