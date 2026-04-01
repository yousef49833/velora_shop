<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use Illuminate\Http\Request;

class CategoryController extends Controller
{
    public function index()
    {
        return response()->json(Category::with('children')->get());
    }

    public function store(Request $request)
    {
        $this->authorizeAdmin($request);

        $data = $request->validate([
            'name' => 'required|string|max:255|unique:categories,name',
            'parent_id' => 'nullable|exists:categories,id',
        ]);

        $category = Category::create($data);

        return response()->json($category, 201);
    }

    private function authorizeAdmin(Request $request)
    {
        $user = $this->authUser($request);
        if (! $user->isAdmin()) {
            abort(403, 'Admin access required');
        }

        return $user;
    }
}
