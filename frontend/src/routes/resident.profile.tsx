import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { serverSignOut } from "@/lib/auth.functions";
import { useState } from "react";

import { useAuth } from "@/store/auth";
import { useSettings } from "@/store/settings";
import { useBookings } from "@/store/bookings";
import { useI18n } from "@/store/i18n";
import { useT } from "@/lib/i18n";


export const Route = createFileRoute("/resident/profile")({
  component: ProfilePage,
});


function ProfilePage() {

  const navigate = useNavigate();
  const tr = useT();

  const session = useAuth((s) => s.session);
  const logout = useAuth((s) => s.logout);

  const radius = useSettings((s) => s.alertRadius);
  const setRadius = useSettings((s) => s.setAlertRadius);

  const lang = useI18n((s) => s.lang);
  const setLang = useI18n((s) => s.setLang);


  const [draft, setDraft] = useState(radius);


  if (!session) {
    return (
      <div className="p-6 text-center">
        Loading profile...
      </div>
    );
  }


  const phone =
    session.role === "resident"
      ? session.phone
      : "0000000000";


  const initials = phone.slice(-2);


  const options = [
    100,
    250,
    500,
    1000
  ];


  const bookings = useBookings(
    (s) => s.bookings
  );


  const myBookings =
    bookings.filter(
      (b) => b.residentPhone === phone
    );


  const pending =
    myBookings.filter(
      (b) => b.status === "pending"
    ).length;



  return (

    <div className="
      min-h-screen
      bg-white
      overflow-y-auto
      px-6
      py-8
    ">


      {/* Profile Header */}

      <div className="
        flex
        items-center
        gap-4
      ">

        <div className="
          w-16
          h-16
          rounded-full
          bg-black
          text-white
          flex
          items-center
          justify-center
          font-bold
          text-xl
        ">
          {initials}
        </div>


        <div>

          <h2 className="font-bold">
            +91 {phone}
          </h2>

          <p className="text-sm text-gray-500">
            {tr("Resident")}
          </p>

        </div>

      </div>



      {/* Alert Distance */}

      <div className="mt-8">

        <h3 className="font-bold">
          {tr("Alert distance")}
        </h3>


        <p className="
          text-sm
          text-gray-500
          mt-1
        ">
          {tr("You will get alert when truck is nearby.")}
        </p>



        <div className="
          grid
          grid-cols-4
          gap-2
          mt-4
        ">


          {
            options.map((item) => (

              <button

                key={item}

                onClick={() =>
                  setDraft(item)
                }

                className={`
                  rounded-full
                  py-2
                  text-sm
                  ${draft === item
                    ?
                    "bg-black text-white"
                    :
                    "bg-gray-100"
                  }
                `}

              >

                {
                  item >= 1000
                    ?
                    "1km"
                    :
                    item + "m"
                }

              </button>


            ))
          }


        </div>


        {
          draft !== radius &&

          <button

            onClick={() =>
              setRadius(draft)
            }

            className="
              mt-4
              w-full
              bg-green-600
              text-white
              rounded-xl
              py-3
            "

          >
            {tr("Save Preferences")}

          </button>
        }


      </div>




      {/* Booking */}

      <div className="mt-8">


        <button

          onClick={() =>
            navigate({
              to: "/resident/booking"
            })
          }

          className="
            w-full
            border
            rounded-xl
            p-4
            text-left
          "

        >

          <h3 className="font-bold">
            {tr("Book a Big Dustbin")}
          </h3>


          <p className="text-sm text-gray-500">
            {tr("Weddings, parties & functions")}
          </p>


          {
            myBookings.length > 0 &&

            <p className="text-xs mt-2">

              {myBookings.length} requests
              {
                pending > 0 &&
                ` • ${pending} pending`
              }

            </p>
          }


        </button>


      </div>





      {/* Settings */}

      <div className="mt-8">


        <div className="
          flex
          justify-between
          border-b
          py-3
        ">

          <span>
            {tr("Language")}
          </span>


          <select

            value={lang}

            onChange={(e) =>
              setLang(
                e.target.value as
                "en" | "hi" | "mr"
              )
            }

          >

            <option value="en">
              English
            </option>

            <option value="hi">
              हिंदी
            </option>


            <option value="mr">
              मराठी
            </option>


          </select>


        </div>



        <Row
          label={tr("Help & Support")}
          value=">"
        />


        <Row
          label={tr("About CleanTrack")}
          value="v1.0"
        />


      </div>





      {/* Logout */}

      <button

        onClick={async () => {

          await serverSignOut();

          logout();

          navigate({
            to: "/role"
          });

        }}

        className="
          mt-10
          w-full
          border
          border-red-300
          text-red-600
          rounded-xl
          py-3
        "

      >

        {tr("Logout")}

      </button>



    </div>

  );

}




function Row(
  {
    label,
    value
  }
    :
    {
      label: string;
      value: string;
    }

) {


  return (

    <div className="
flex
justify-between
border-b
py-3
">

      <span>
        {label}
      </span>

      <span className="text-gray-500">
        {value}
      </span>


    </div>

  );


}
