#include <cairommconfig.h>
#include <cairomm/context.h>
#include <cairomm/surface.h>

using namespace Cairo;
using namespace std;

int main() {
    RefPtr<ImageSurface> surface = ImageSurface::create(FORMAT_ARGB32, 600, 400);

    RefPtr<Context> cr = Context::create(surface);

    cr->save();
    cr->set_source_rgb(1, 1, 1);
    cr->paint();
    cr->restore();

    cr->save();
    cr->set_source_rgb(220.0/255, 20.0/255, 60.0/255);
    cr->arc(300, 200, 150, 0, 2 * M_PI);
    cr->fill();
    cr->restore();

    surface->write_to_png("output.png");
}
