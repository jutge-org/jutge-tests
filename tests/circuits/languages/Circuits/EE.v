module bus_invert (
  input [7:0] in,
  output [7:0] out
);
	integer i;
	initial begin
		for (i = 0; i < 999999999999999999; i = i + 1) begin
			$display ("Infinite loop #%0d ", i);
            out = ~ in;
		end
	end

endmodule
