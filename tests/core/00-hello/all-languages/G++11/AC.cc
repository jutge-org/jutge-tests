#include <iostream>
#include <set>
using namespace std;

int main() {
    cout << "Hello world!" << endl;

    // be sure it is C++11
    set<int> S;
    for (auto x : S) cout << x << endl;
}
