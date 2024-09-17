-- Ada

with Text_Io; 
use Text_Io;

procedure program is
    a: integer;
begin
    a := 1;
    while true loop
        a := (a+1) mod 100;
    end loop;
end program;
