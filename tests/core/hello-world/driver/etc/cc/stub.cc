// Wrapper for C++ compiler that uses some tweaks to
// speed up the program execution and catches several
// exceptions and give an accurate verdict.

#include <cstdlib>
#include <exception>
#include <iostream>
#include <signal.h>

// the following code will be executed if main throws an exception
[[noreturn]] void jutge__stub__on_terminate() noexcept
{
    if (auto exc = std::current_exception()) {
        // we have an exception
        try {
            std::rethrow_exception(exc); // throw to recognize the type
        } catch (std::bad_alloc& exc) {
            raise(SIGUSR1);
        } catch (std::exception& exc) {
            raise(SIGUSR2);
        } catch (...) {
            raise(SIGUSR2);
        }
    }
    std::_Exit(0);
}

// the following function should be executed before main
int jutge__stub__initialization()
{
    // handle exception from main
    std::set_terminate(&jutge__stub__on_terminate);

    // speedup io
    std::ios_base::sync_with_stdio(false);
    std::cin.tie(0);

    // return something
    return 999;
}

// the following global variable gets initialized before main
int jutge__stub__initialization_global_variable = jutge__stub__initialization();
